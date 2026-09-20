import { Readable } from "node:stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { hasAdminSession, signedInUserId } from "../lib/adminAuth";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

function requireAdmin(req: Request, res: Response): boolean {
  const userId = signedInUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in required" });
    return false;
  }
  if (!hasAdminSession(req, userId)) {
    res.status(403).json({ error: "Admin unlock required" });
    return false;
  }
  return true;
}

router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.contentType.startsWith("image/")) {
    res.status(400).json({ error: "Only image uploads are supported" });
    return;
  }
  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath, metadata: parsed.data }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create object upload URL");
    res.status(500).json({ error: "Failed to create upload URL" });
  }
});

router.get("/storage/objects/*path", async (req, res): Promise<void> => {
  try {
    const raw = req.params.path;
    const path = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorage.getObjectEntityFile(`/objects/${path}`);
    const response = await objectStorage.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Failed to serve object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;