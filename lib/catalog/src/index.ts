export type GameCategory = {
  slug: string;
  name: string;
  description: string;
  color: string;
  children?: string[];
};

export type Game = {
  slug: string;
  title: string;
  alternateNames: string[];
  categorySlugs: string[];
  eyebrow: string;
  description: string;
  players: string;
  setup: string;
  age: string;
  duration: string;
  equipment: string[];
  objective: string;
  rules: string[];
  accent: string;
  icon: string;
  articleMarkdown?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  description: string;
  imageDataUrl?: string;
  imagePath?: string;
};

export type CatalogState = {
  categories: Record<string, GameCategory>;
  primaryCategories: string[];
  games: Game[];
  inventory: Record<string, InventoryItem[]>;
};

export const categories: Record<string, GameCategory> = {
  'card-games': { slug: 'card-games', name: 'Card games', description: 'Small decks, big table energy.', color: '#f9be4b', children: ['classic-cards', 'modern-cards'] },
  'classic-cards': { slug: 'classic-cards', name: 'Classic cards', description: 'The rules everyone half-remembers.', color: '#f6a65b', children: ['poker'] },
  'modern-cards': { slug: 'modern-cards', name: 'Modern cards', description: 'Fast turns and clever risks.', color: '#f9be4b', children: ['flip-7'] },
  'party-games': { slug: 'party-games', name: 'Party games', description: 'Low setup. Maximum table talk.', color: '#e98fcb', children: ['bluffing', 'social-deduction'] },
  bluffing: { slug: 'bluffing', name: 'Bluffing', description: 'Read the room. Sell the lie.', color: '#d59de5', children: [] },
  'social-deduction': { slug: 'social-deduction', name: 'Social deduction', description: 'Trust nobody too quickly.', color: '#e98fcb', children: ['mafia'] },
  sports: { slug: 'sports', name: 'Sports & active', description: 'Move first, keep score second.', color: '#42d1b1', children: ['court-sports'] },
  'court-sports': { slug: 'court-sports', name: 'Court sports', description: 'Lines, rallies, and one more game.', color: '#42d1b1', children: ['pickleball'] },
  'strategy-tabletop': { slug: 'strategy-tabletop', name: 'Strategy & tabletop', description: 'A little thinking goes a long way.', color: '#88a6ff', children: ['puzzle-games'] },
  'puzzle-games': { slug: 'puzzle-games', name: 'Puzzle games', description: 'Patterns, portals, and lateral thinking.', color: '#88a6ff', children: ['portal'] },
};

export const primaryCategories = ['card-games', 'party-games', 'sports', 'strategy-tabletop'];

export const games: Game[] = [
  {
    slug: 'flip-7',
    title: 'Flip 7',
    alternateNames: ['Flip Seven', 'Flip 7 card game'],
    categorySlugs: ['card-games', 'modern-cards'],
    eyebrow: 'Risk it for the seven',
    description: 'A push-your-luck card game where the table gets louder every time you flip.',
    players: '3–18 players',
    setup: '2 minutes',
    age: '8+',
    duration: '20 minutes',
    equipment: ['Flip 7 deck', 'Score sheet', 'Something to write with'],
    objective: 'Score the most points by flipping cards without repeating a number. Flip seven unique numbers and you win the round instantly.',
    rules: [
      'Shuffle the deck and deal one card face up to each player.',
      'On your turn, choose Hit to flip another card or Stay to bank your round score.',
      'A duplicate number busts your round and scores zero. Keep your unique cards visible.',
      'A player who reveals seven different numbers wins the round immediately.',
      'Play until someone reaches 200 points, then the highest score wins.',
    ],
    accent: '#f9be4b',
    icon: '7',
    articleMarkdown: '## Ready to play?\n\nFlip 7 is a push-your-luck game. **Stay** to bank your points, or *hit* to try for more.\n\n- Keep unique number cards in front of you\n- A duplicate number ends your round\n- Flip seven unique numbers to win instantly',
  },
  {
    slug: 'pickleball',
    title: 'Pickleball',
    alternateNames: ['Pickle ball', 'court rally'],
    categorySlugs: ['sports', 'court-sports'],
    eyebrow: 'A rally with a little bite',
    description: 'The quick-learning court game that rewards placement, patience, and a soft touch.',
    players: '2 or 4 players',
    setup: '10 minutes',
    age: 'All ages',
    duration: '30–60 minutes',
    equipment: ['Pickleball paddles', 'Pickleball', 'Net', 'Court'],
    objective: 'Win rallies and be the first side to reach 11 points, winning by two. In traditional scoring, only the serving side can score.',
    rules: [
      'Serve diagonally underhand from behind the baseline, below waist height.',
      'The serve must clear the non-volley zone and land in the opposite service court.',
      'Let the serve bounce, then let the return bounce before hitting volleys.',
      'Do not volley while standing in the seven-foot non-volley zone.',
      'Call the score before each serve. First to 11 by two wins the game.',
    ],
    accent: '#42d1b1',
    icon: 'P',
    articleMarkdown: '## The quick court guide\n\nPickleball is played as singles or doubles. **Serve diagonally**, let the ball bounce on both sides, and keep volleys out of the kitchen.\n\n1. Serve underhand below the waist\n2. Let the serve and return bounce\n3. Win by two points',
  },
  {
    slug: 'poker',
    title: 'Poker',
    alternateNames: ['Texas hold em', 'Texas hold’em', 'holdem'],
    categorySlugs: ['card-games', 'classic-cards'],
    eyebrow: 'Read the table',
    description: 'The classic community-card game of incomplete information and well-timed confidence.',
    players: '2–10 players',
    setup: '5 minutes',
    age: '18+',
    duration: '30–120 minutes',
    equipment: ['52-card deck', 'Chips or counters', 'Flat playing surface'],
    objective: 'Win the pot by making the best five-card hand from your two private cards and five shared cards, or by convincing everyone else to fold.',
    rules: [
      'The dealer gives each player two cards face down. The two players left of the dealer post blinds.',
      'Players take turns calling, raising, or folding during the pre-flop betting round.',
      'The dealer reveals three shared cards (the flop), followed by a betting round.',
      'Reveal the turn, bet again, then reveal the river for the final betting round.',
      'Remaining players show hands. The strongest five-card combination takes the pot.',
    ],
    accent: '#f6a65b',
    icon: 'A',
    articleMarkdown: '## Texas hold’em basics\n\nBuild the best five-card hand from your two private cards and five shared cards.\n\n- **Fold** to leave the hand\n- **Call** to match the current bet\n- *Raise* to increase it',
  },
  {
    slug: 'portal',
    title: 'Portal',
    alternateNames: ['Portal board game', 'co-operative puzzle'],
    categorySlugs: ['strategy-tabletop', 'puzzle-games'],
    eyebrow: 'Think sideways',
    description: 'A compact cooperative puzzle for people who like their answers one step stranger.',
    players: '1–4 players',
    setup: '3 minutes',
    age: '10+',
    duration: '20–40 minutes',
    equipment: ['Puzzle cards', 'Tokens', 'Timer (optional)'],
    objective: 'Solve a chain of spatial and lateral-thinking puzzles before the group runs out of shared attempts.',
    rules: [
      'Choose a puzzle card and place its starting pieces exactly as shown.',
      'Discuss possible moves openly, but only the active player may touch pieces.',
      'Spend one attempt to test a move. Some pieces can pass through a portal and change direction.',
      'If a move completes the target pattern, advance to the next card.',
      'Finish the sequence with attempts remaining to beat the table record.',
    ],
    accent: '#88a6ff',
    icon: 'O',
    articleMarkdown: '## Solve it together\n\nTalk through each possibility before spending an attempt. Mark the route, test one move at a time, and look for patterns on the other side of each portal.',
  },
  {
    slug: 'mafia',
    title: 'Mafia',
    alternateNames: ['Werewolf', 'social deduction game', 'The Village'],
    categorySlugs: ['party-games', 'social-deduction'],
    eyebrow: 'The room is lying',
    description: 'A moderator-led game of hidden roles, suspicious alibis, and one very long night.',
    players: '7–20 players',
    setup: '8 minutes',
    age: '12+',
    duration: '30–60 minutes',
    equipment: ['Role cards or slips of paper', 'One moderator', 'A way to track votes'],
    objective: 'The town must identify and eliminate every Mafia member. The Mafia wins when they equal or outnumber the remaining town.',
    rules: [
      'The moderator secretly assigns Mafia, Detective, Doctor, and Town roles.',
      'At night, everyone closes their eyes. Mafia choose a target; the Detective investigates; the Doctor protects.',
      'At dawn, the moderator announces the result of the night.',
      'The living players debate and vote to eliminate one suspect during the day.',
      'Repeat night and day until the Mafia are gone or they control the vote.',
    ],
    accent: '#e98fcb',
    icon: 'M',
    articleMarkdown: '## Day and night\n\nThe town wins by finding the Mafia. The Mafia wins when they control the vote.\n\n- At night, hidden roles act quietly\n- During the day, everyone debates\n- The town votes to eliminate one player',
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function starterInventory(): Record<string, InventoryItem[]> {
  return Object.fromEntries(games.map((game) => [
    game.slug,
    game.equipment.map((item, index) => ({
      id: `${game.slug}-starter-${index}`,
      name: item,
      description: 'Starter table equipment',
      imageDataUrl: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><rect width="640" height="420" rx="36" fill="${game.accent}"/><path d="M0 300 180 160l120 80 120-150 220 180v150H0Z" fill="#171821" opacity=".28"/><text x="42" y="92" fill="#171821" font-family="monospace" font-size="24" font-weight="700">${item.slice(0, 24)}</text><text x="42" y="360" fill="#171821" font-family="monospace" font-size="18">${game.icon} / FIELD GUIDE</text></svg>`)}`,
    })),
  ])) as Record<string, InventoryItem[]>;
}

export function createSeedCatalog(): CatalogState {
  return {
    categories: clone(categories),
    primaryCategories: [...primaryCategories],
    games: clone(games),
    inventory: starterInventory(),
  };
}

function isGame(value: unknown): value is Game {
  return Boolean(value && typeof value === 'object' && typeof (value as Game).slug === 'string' && typeof (value as Game).title === 'string');
}

export function normalizeCatalog(value: unknown): CatalogState {
  const seed = createSeedCatalog();
  if (!value || typeof value !== 'object') return seed;
  const candidate = value as Partial<CatalogState>;
  const rawCategories = candidate.categories && typeof candidate.categories === 'object' ? candidate.categories : seed.categories;
  const safeCategories = Object.fromEntries(
    Object.entries(rawCategories)
      .filter(([slug, category]) => Boolean(category && typeof category === 'object' && slug && typeof (category as GameCategory).name === 'string'))
      .map(([slug, category]) => {
        const item = category as GameCategory;
        return [slug, { slug, name: item.name, description: typeof item.description === 'string' ? item.description : 'A shelf for good games.', color: typeof item.color === 'string' ? item.color : '#f9be4b', children: Array.isArray(item.children) ? item.children.filter((child): child is string => typeof child === 'string') : [] }];
      }),
  ) as Record<string, GameCategory>;
  const safeGames = Array.isArray(candidate.games) ? candidate.games.filter(isGame).map((game) => ({
    ...game,
    alternateNames: Array.isArray(game.alternateNames) ? game.alternateNames.filter((name): name is string => typeof name === 'string') : [],
    categorySlugs: Array.isArray(game.categorySlugs) ? game.categorySlugs.filter((category): category is string => typeof category === 'string' && Boolean(safeCategories[category])) : [],
    equipment: Array.isArray(game.equipment) ? game.equipment.filter((item): item is string => typeof item === 'string') : [],
    rules: Array.isArray(game.rules) ? game.rules.filter((rule): rule is string => typeof rule === 'string') : [],
  })) : seed.games;
  const safePrimary = Array.isArray(candidate.primaryCategories) ? candidate.primaryCategories.filter((slug): slug is string => typeof slug === 'string' && Boolean(safeCategories[slug])) : seed.primaryCategories.filter((slug) => Boolean(safeCategories[slug]));
  const safeInventory: Record<string, InventoryItem[]> = {};
  if (candidate.inventory && typeof candidate.inventory === 'object') {
    for (const [gameSlug, items] of Object.entries(candidate.inventory)) {
      if (!safeGames.some((game) => game.slug === gameSlug) || !Array.isArray(items)) continue;
      safeInventory[gameSlug] = items.filter((item): item is InventoryItem => Boolean(item && typeof item === 'object' && typeof (item as InventoryItem).id === 'string' && typeof (item as InventoryItem).name === 'string')).map((item) => ({
        id: item.id,
        name: item.name,
        description: typeof item.description === 'string' ? item.description : 'Table item',
        ...(typeof item.imageDataUrl === 'string' ? { imageDataUrl: item.imageDataUrl } : {}),
        ...(typeof item.imagePath === 'string' ? { imagePath: item.imagePath } : {}),
      }));
    }
  }
  return { categories: safeCategories, primaryCategories: safePrimary, games: safeGames, inventory: safeInventory };
}

export function getGame(slug: string) {
  return games.find((game) => game.slug === slug);
}

export function getCategory(slug: string) {
  return categories[slug];
}

export function gamesForCategory(slug: string) {
  return games.filter((game) => game.categorySlugs.includes(slug));
}

export function searchGames(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return games;
  return games.filter((game) => [game.title, game.eyebrow, game.description, ...game.alternateNames, ...game.categorySlugs.map((slug) => categories[slug]?.name)].filter(Boolean).some((value) => value!.toLowerCase().includes(normalized)));
}