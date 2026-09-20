import { createSeedCatalog, normalizeCatalog, type CatalogState, type InventoryItem } from '@workspace/catalog';

export { createSeedCatalog, normalizeCatalog };
export type { CatalogState, InventoryItem };

export const CATALOG_STORAGE_KEY = 'games-io-catalog-v1';

export function readCatalog(): CatalogState {
  try {
    const stored = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    return stored ? normalizeCatalog(JSON.parse(stored)) : createSeedCatalog();
  } catch {
    return createSeedCatalog();
  }
}

export function writeCatalog(state: CatalogState) {
  window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(state));
}

export function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `shelf-${Date.now()}`;
}