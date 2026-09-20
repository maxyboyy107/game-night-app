import { createSeedCatalog, normalizeCatalog, type CatalogState, type InventoryItem } from '@workspace/catalog';

export { createSeedCatalog, normalizeCatalog };
export type { CatalogState, InventoryItem };

export function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `shelf-${Date.now()}`;
}