import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, catalogStateTable } from "@workspace/db";
import { normalizeCatalog, type CatalogState } from "@workspace/catalog";
import {
  ExportCatalogBackupResponse,
  GetCatalogAdminStatusResponse,
  GetCatalogResponse,
  RestoreCatalogBackupBody,
  RestoreCatalogBackupResponse,
  SaveCatalogBody,
  SaveCatalogResponse,
  UnlockCatalogAdminBody,
  UnlockCatalogAdminResponse,
} from "@workspace/api-zod";
import { hasAdminSession, issueAdminSession, passwordMatches, signedInUserId } from "../lib/adminAuth";
import { loadCatalogState, saveLatestCatalogBackup } from "../lib/catalogPersistence";

const router: IRouter = Router();

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
  const catalog = await loadCatalogState();
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
  try {
    await saveLatestCatalogBackup(catalog);
  } catch (error) {
    req.log.error({ err: error }, "Catalog saved to PostgreSQL but its App Storage backup failed");
    res.status(503).json({ error: "Catalog saved, but its durable backup could not be updated. Download a backup before leaving admin." });
    return;
  }
  res.json(SaveCatalogResponse.parse(catalog));
});

router.get("/catalog/backup", async (req, res): Promise<void> => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  const catalog = await loadCatalogState();
  res.setHeader("Content-Disposition", 'attachment; filename="games-io-catalog-backup.json"');
  res.json(ExportCatalogBackupResponse.parse({
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    catalog,
  }));
});

router.put("/catalog/backup", async (req, res): Promise<void> => {
  const userId = await requireAdmin(req, res);
  if (!userId) return;
  const parsed = RestoreCatalogBackupBody.safeParse(req.body);
  if (!parsed.success || parsed.data.schemaVersion !== 1) {
    res.status(400).json({ error: "Choose a valid games.io catalog backup." });
    return;
  }
  const catalog = normalizeCatalog(parsed.data.catalog);
  await db.insert(catalogStateTable).values({ id: 1, data: catalog, updatedBy: userId }).onConflictDoUpdate({
    target: catalogStateTable.id,
    set: { data: catalog, updatedBy: userId, updatedAt: new Date() },
  });
  try {
    await saveLatestCatalogBackup(catalog);
  } catch (error) {
    req.log.error({ err: error }, "Restored catalog saved to PostgreSQL but its App Storage backup failed");
    res.status(503).json({ error: "Catalog restored, but its durable backup could not be updated." });
    return;
  }
  res.json(RestoreCatalogBackupResponse.parse(catalog));
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