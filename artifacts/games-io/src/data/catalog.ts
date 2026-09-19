import { categories, games, primaryCategories, type Game, type GameCategory } from './games';

export type InventoryItem = {
  id: string;
  name: string;
  description: string;
  imageDataUrl?: string;
};

export type CatalogState = {
  categories: Record<string, GameCategory>;
  primaryCategories: string[];
  games: Game[];
  inventory: Record<string, InventoryItem[]>;
};

export const CATALOG_STORAGE_KEY = 'games-io-catalog-v1';

export function createSeedCatalog(): CatalogState {
  const seededGames = JSON.parse(JSON.stringify(games)) as Game[];
  const inventory = Object.fromEntries(seededGames.map((game) => [
    game.slug,
    game.equipment.map((item, index) => ({
      id: `${game.slug}-starter-${index}`,
      name: item,
      description: 'Starter table equipment',
      imageDataUrl: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><rect width="640" height="420" rx="36" fill="${game.accent}"/><path d="M0 300 180 160l120 80 120-150 220 180v150H0Z" fill="#171821" opacity=".28"/><text x="42" y="92" fill="#171821" font-family="monospace" font-size="24" font-weight="700">${item.slice(0, 24)}</text><text x="42" y="360" fill="#171821" font-family="monospace" font-size="18">${game.icon} / FIELD GUIDE</text></svg>`)}`,
    })),
  ])) as Record<string, InventoryItem[]>;
  return {
    categories: JSON.parse(JSON.stringify(categories)) as Record<string, GameCategory>,
    primaryCategories: [...primaryCategories],
    games: seededGames,
    inventory,
  };
}

function isGame(value: unknown): value is Game {
  return Boolean(value && typeof value === 'object' && typeof (value as Game).slug === 'string' && typeof (value as Game).title === 'string');
}

export function normalizeCatalog(value: unknown): CatalogState {
  const seed = createSeedCatalog();
  if (!value || typeof value !== 'object') return seed;
  const candidate = value as Partial<CatalogState>;
  const nextCategories = candidate.categories && typeof candidate.categories === 'object' ? candidate.categories : seed.categories;
  const safeCategories = Object.fromEntries(
    Object.entries(nextCategories)
      .filter(([slug, category]) => Boolean(category && typeof category === 'object' && slug && typeof (category as GameCategory).name === 'string'))
      .map(([slug, category]) => {
        const item = category as GameCategory;
        return [slug, { slug, name: item.name, description: typeof item.description === 'string' ? item.description : 'A shelf for good games.', color: typeof item.color === 'string' ? item.color : '#f9be4b', children: Array.isArray(item.children) ? item.children.filter((child): child is string => typeof child === 'string') : [] }];
      }),
  ) as Record<string, GameCategory>;
  const safeGames = Array.isArray(candidate.games) ? candidate.games.filter(isGame).map((game) => ({
    ...game,
    alternateNames: Array.isArray(game.alternateNames) ? game.alternateNames.filter((name): name is string => typeof name === 'string') : [],
    categorySlugs: Array.isArray(game.categorySlugs) ? game.categorySlugs.filter((category): category is string => typeof category === 'string') : [],
    equipment: Array.isArray(game.equipment) ? game.equipment.filter((item): item is string => typeof item === 'string') : [],
    rules: Array.isArray(game.rules) ? game.rules.filter((rule): rule is string => typeof rule === 'string') : [],
  })) : seed.games;
  const safePrimary = Array.isArray(candidate.primaryCategories)
    ? candidate.primaryCategories.filter((slug): slug is string => typeof slug === 'string' && Boolean(safeCategories[slug]))
    : seed.primaryCategories.filter((slug) => Boolean(safeCategories[slug]));
  const safeInventory: Record<string, InventoryItem[]> = {};
  if (candidate.inventory && typeof candidate.inventory === 'object') {
    for (const [gameSlug, items] of Object.entries(candidate.inventory)) {
      if (!safeGames.some((game) => game.slug === gameSlug) || !Array.isArray(items)) continue;
      safeInventory[gameSlug] = items.filter((item): item is InventoryItem => Boolean(item && typeof item === 'object' && typeof (item as InventoryItem).id === 'string' && typeof (item as InventoryItem).name === 'string'));
    }
  }
  return { categories: safeCategories, primaryCategories: safePrimary, games: safeGames, inventory: safeInventory };
}

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