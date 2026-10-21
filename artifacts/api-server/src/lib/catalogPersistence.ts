import { eq } from "drizzle-orm";
import { db, catalogStateTable } from "@workspace/db";
import { createSeedCatalog, normalizeCatalog, type CatalogState } from "@workspace/catalog";
import { ExportCatalogBackupResponse } from "@workspace/api-zod";
import { ObjectStorageService } from "./objectStorage";

const objectStorage = new ObjectStorageService();

export async function loadCatalogState(): Promise<CatalogState> {
  const [row] = await db.select().from(catalogStateTable).where(eq(catalogStateTable.id, 1));
  if (row?.data) return normalizeCatalog(row.data);

  const savedBackup = await objectStorage.readJsonBackup<unknown>("catalog/latest");
  if (savedBackup) {
    const parsed = ExportCatalogBackupResponse.safeParse(savedBackup);
    if (!parsed.success) throw new Error("The saved catalog backup is invalid.");
    const catalog = normalizeCatalog(parsed.data.catalog);
    await db.insert(catalogStateTable).values({
      id: 1,
      data: catalog,
      updatedBy: "automatic-backup-restore",
    }).onConflictDoNothing();
    return catalog;
  }

  return createSeedCatalog();
}

export async function saveLatestCatalogBackup(catalog: CatalogState): Promise<void> {
  const backup = ExportCatalogBackupResponse.parse({
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    catalog: normalizeCatalog(catalog),
  });
  await objectStorage.writeJsonBackup("catalog/latest", backup);
}
