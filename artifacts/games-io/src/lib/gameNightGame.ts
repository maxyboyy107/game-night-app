import type { GameNightLocalGame } from '@workspace/api-client-react';
import type { Game } from '../data/games';

export function localGameToGuide(game: GameNightLocalGame): Game {
  return {
    slug: game.slug,
    title: game.title,
    alternateNames: [],
    categorySlugs: [],
    eyebrow: 'Family Game Night · Local game',
    description: game.description,
    players: `${game.minPlayers}–${game.maxPlayers} players`,
    setup: 'Set up at your table',
    age: 'Family rules',
    duration: 'Varies',
    equipment: [],
    objective: game.description,
    rules: game.rules.split('\n').filter(Boolean),
    accent: '#42d1b1',
    icon: '★',
    scorekeeperModes: game.scorekeeperModes,
    variations: game.variations,
  };
}
