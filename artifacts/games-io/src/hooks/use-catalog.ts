import { useCallback, useEffect, useState } from 'react';
import { createSeedCatalog, readCatalog, slugify, writeCatalog, type CatalogState, type InventoryItem } from '../data/catalog';
import type { Game, GameCategory } from '../data/games';

export function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogState>(() => readCatalog());

  useEffect(() => {
    writeCatalog(catalog);
  }, [catalog]);

  const update = useCallback((change: (current: CatalogState) => CatalogState) => {
    setCatalog((current) => change(current));
  }, []);

  const resetCatalog = useCallback(() => setCatalog(createSeedCatalog()), []);
  const addCategory = useCallback((input: Omit<GameCategory, 'slug'> & { slug?: string; parentSlug?: string; primary?: boolean }) => {
    update((current) => {
      const slug = slugify(input.slug || input.name);
      if (current.categories[slug]) return current;
      const category: GameCategory = { slug, name: input.name.trim(), description: input.description.trim(), color: input.color, children: [] };
      const categories = { ...current.categories, [slug]: category };
      if (input.parentSlug && categories[input.parentSlug]) {
        categories[input.parentSlug] = { ...categories[input.parentSlug], children: [...(categories[input.parentSlug].children || []), slug] };
      }
      return { ...current, categories, primaryCategories: input.primary || !input.parentSlug ? [...current.primaryCategories, slug] : current.primaryCategories };
    });
  }, [update]);
  const removeCategory = useCallback((slug: string) => {
    update((current) => {
      if (!current.categories[slug]) return current;
      const categories = Object.fromEntries(Object.entries(current.categories).filter(([key]) => key !== slug).map(([key, category]) => [key, { ...category, children: category.children?.filter((child) => child !== slug) }])) as Record<string, GameCategory>;
      return {
        ...current,
        categories,
        primaryCategories: current.primaryCategories.filter((item) => item !== slug),
        games: current.games.map((game) => ({ ...game, categorySlugs: game.categorySlugs.filter((item) => item !== slug) })),
      };
    });
  }, [update]);
  const addGame = useCallback((game: Game) => update((current) => current.games.some((item) => item.slug === game.slug) ? current : { ...current, games: [...current.games, game] }), [update]);
  const updateGame = useCallback((slug: string, patch: Partial<Game>) => update((current) => ({ ...current, games: current.games.map((game) => game.slug === slug ? { ...game, ...patch } : game) })), [update]);
  const removeGame = useCallback((slug: string) => update((current) => {
    const inventory = { ...current.inventory };
    delete inventory[slug];
    return { ...current, games: current.games.filter((game) => game.slug !== slug), inventory };
  }), [update]);
  const addInventoryItem = useCallback((gameSlug: string, item: InventoryItem) => update((current) => ({ ...current, inventory: { ...current.inventory, [gameSlug]: [...(current.inventory[gameSlug] || []), item] } })), [update]);
  const removeInventoryItem = useCallback((gameSlug: string, itemId: string) => update((current) => ({ ...current, inventory: { ...current.inventory, [gameSlug]: (current.inventory[gameSlug] || []).filter((item) => item.id !== itemId) } })), [update]);

  return { catalog, addCategory, removeCategory, addGame, updateGame, removeGame, addInventoryItem, removeInventoryItem, resetCatalog };
}