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
};

export const categories: Record<string, GameCategory> = {
  'card-games': {
    slug: 'card-games',
    name: 'Card games',
    description: 'Small decks, big table energy.',
    color: '#f9be4b',
    children: ['classic-cards', 'modern-cards'],
  },
  'classic-cards': {
    slug: 'classic-cards',
    name: 'Classic cards',
    description: 'The rules everyone half-remembers.',
    color: '#f6a65b',
    children: ['poker'],
  },
  'modern-cards': {
    slug: 'modern-cards',
    name: 'Modern cards',
    description: 'Fast turns and clever risks.',
    color: '#f9be4b',
    children: ['flip-7'],
  },
  'party-games': {
    slug: 'party-games',
    name: 'Party games',
    description: 'Low setup. Maximum table talk.',
    color: '#e98fcb',
    children: ['bluffing', 'social-deduction'],
  },
  bluffing: {
    slug: 'bluffing',
    name: 'Bluffing',
    description: 'Read the room. Sell the lie.',
    color: '#d59de5',
    children: [],
  },
  'social-deduction': {
    slug: 'social-deduction',
    name: 'Social deduction',
    description: 'Trust nobody too quickly.',
    color: '#e98fcb',
    children: ['mafia'],
  },
  sports: {
    slug: 'sports',
    name: 'Sports & active',
    description: 'Move first, keep score second.',
    color: '#42d1b1',
    children: ['court-sports'],
  },
  'court-sports': {
    slug: 'court-sports',
    name: 'Court sports',
    description: 'Lines, rallies, and one more game.',
    color: '#42d1b1',
    children: ['pickleball'],
  },
  'strategy-tabletop': {
    slug: 'strategy-tabletop',
    name: 'Strategy & tabletop',
    description: 'A little thinking goes a long way.',
    color: '#88a6ff',
    children: ['puzzle-games'],
  },
  'puzzle-games': {
    slug: 'puzzle-games',
    name: 'Puzzle games',
    description: 'Patterns, portals, and lateral thinking.',
    color: '#88a6ff',
    children: ['portal'],
  },
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
  },
];

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
  return games.filter((game) =>
    [game.title, game.eyebrow, game.description, ...game.alternateNames, ...game.categorySlugs.map((slug) => categories[slug]?.name)]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized)),
  );
}