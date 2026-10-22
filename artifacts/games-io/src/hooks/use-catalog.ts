import { useCallback, useEffect, useRef, useState } from 'react';
import { saveCatalog } from '@workspace/api-client-react';
import { createSeedCatalog, slugify, type CatalogState, type InventoryItem } from '../data/catalog';
import type { Game, GameCategory } from '../data/games';

export function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogState>(() => createSeedCatalog());
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const catalogRef = useRef(catalog);
  const catalogLoaded = useRef(false);
  const loadVersion = useRef(0);
  const saveTimer = useRef<number | undefined>(undefined);
  const saveVersion = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const loadCatalog = useCallback(async () => {
    const version = ++loadVersion.current;
    catalogLoaded.current = false;
    setLoadState('loading');
    try {
      const response = await fetch('/api/catalog', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Catalog request failed');
      const remoteCatalog = await response.json() as CatalogState;
      if (version !== loadVersion.current) return;
      catalogRef.current = remoteCatalog;
      setCatalog(remoteCatalog);
      catalogLoaded.current = true;
      setLoadState('loaded');
    } catch {
      if (version === loadVersion.current) setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    return () => { loadVersion.current += 1; };
  }, [loadCatalog]);

  const queueSave = useCallback((next: CatalogState) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const version = ++saveVersion.current;
    setSaveState('saving');
    saveTimer.current = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        try {
          await saveCatalog(next);
          if (version === saveVersion.current) setSaveState('saved');
        } catch {
          if (version === saveVersion.current) setSaveState('error');
        }
      });
    }, 250);
  }, []);

  const update = useCallback((change: (current: CatalogState) => CatalogState) => {
    if (!catalogLoaded.current) return;
    const next = change(catalogRef.current);
    catalogRef.current = next;
    setCatalog(next);
    queueSave(next);
  }, [queueSave]);

  const resetCatalog = useCallback(() => update(() => createSeedCatalog()), [update]);
  const retrySave = useCallback(() => queueSave(catalogRef.current), [queueSave]);
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

  return { catalog, loadState, retryLoad: loadCatalog, saveState, retrySave, addCategory, removeCategory, addGame, updateGame, removeGame, addInventoryItem, removeInventoryItem, resetCatalog };
}