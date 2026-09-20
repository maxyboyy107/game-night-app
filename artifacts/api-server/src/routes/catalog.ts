import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, catalogStateTable } from "@workspace/db";
import { createSeedCatalog, normalizeCatalog, type CatalogState } from "@workspace/catalog";
import {
  GetCatalogAdminStatusResponse,
  GetCatalogResponse,
  SaveCatalogBody,
  SaveCatalogResponse,
  UnlockCatalogAdminBody,
  UnlockCatalogAdminResponse,
} from "@workspace/api-zod";
import { hasAdminSession, issueAdminSession, passwordMatches, signedInUserId } from "../lib/adminAuth";

const router: IRouter = Router();

async function loadCatalog(): Promise<CatalogState> {
  const [row] = await db.select().from(catalogStateTable).where(eq(catalogStateTable.id, 1));
  return normalizeCatalog(row?.data || createSeedCatalog());
}

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = signedInUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in required" });
    return null;
  }
  if (!hasAdminSession(req, userId)) {
    res.status(403).json({ error: "Admin unlock required" });
    return null;
  }
  return userId;
}

router.get("/catalog", async (_req, res): Promise<void> => {
  const catalog = await loadCatalog();
  res.json(GetCatalogResponse.parse(catalog));
});

router.put("/catalog", async (req, res): Promise<void> => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  const parsed = SaveCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const catalog = normalizeCatalog(parsed.data);
  await db.insert(catalogStateTable).values({ id: 1, data: catalog, updatedBy: userId }).onConflictDoUpdate({
    target: catalogStateTable.id,
    set: { data: catalog, updatedBy: userId, updatedAt: new Date() },
  });
  res.json(SaveCatalogResponse.parse(catalog));
});

router.post("/catalog/admin/unlock", async (req, res): Promise<void> => {
  const userId = signedInUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const parsed = UnlockCatalogAdminBody.safeParse(req.body);
  if (!parsed.success || !passwordMatches(parsed.data.password)) {
    res.status(403).json({ error: "Incorrect admin password" });
    return;
  }
  issueAdminSession(res, userId);
  res.json(UnlockCatalogAdminResponse.parse({ unlocked: true }));
});

router.get("/catalog/admin/status", (req, res): void => {
  const userId = signedInUserId(req);
  res.json(GetCatalogAdminStatusResponse.parse({ unlocked: Boolean(userId && hasAdminSession(req, userId)) }));
});

export default router;