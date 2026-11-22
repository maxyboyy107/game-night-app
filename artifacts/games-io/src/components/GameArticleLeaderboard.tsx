import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { getFamilyGameLeaderboard, getGlobalGameLeaderboard } from '@workspace/api-client-react';
import type { Game, ScorekeeperMode } from '../data/games';
import type { GameNightDetail, Leaderboard } from '@workspace/api-client-react';

export function GameArticleLeaderboard({ game, gameNight }: { game: Game; gameNight?: GameNightDetail }) {
  const modes = game.scorekeeperModes?.length ? game.scorekeeperModes : [{ id: 'points', name: 'Points game', strategy: 'points' as const, direction: 'highest' as const }];
  const [modeId, setModeId] = useState(modes[0].id);
  const [scope, setScope] = useState<'family' | 'global'>('family');
  const [board, setBoard] = useState<Leaderboard>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isLocalGame = game.slug.startsWith('local-');
  const selectedMode: ScorekeeperMode | undefined = modes.find((mode) => mode.id === modeId) || modes[0];
  const gameNightId = gameNight?.night.id;

  useEffect(() => {
    if (scope === 'family' && !gameNightId) {
      setBoard(undefined);
      return;
    }
    if (scope === 'global' && isLocalGame) {
      setBoard(undefined);
      return;
    }
    let current = true;
    setLoading(true);
    setError('');
    const request = scope === 'family' && gameNightId
      ? getFamilyGameLeaderboard(game.slug, modeId, gameNightId)
      : getGlobalGameLeaderboard(game.slug, modeId);
    void request.then((result) => {
      if (current) setBoard(result);
    }).catch(() => {
      if (current) setError('Leaderboard could not be loaded.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [game.slug, modeId, scope, gameNightId, isLocalGame]);

  return <section className="mt-8 rounded-2xl border border-white/[0.09] bg-[#171821]/75 p-5" data-testid="panel-article-leaderboard"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f9be4b]">Family & global</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.05em]">Leaderboard</h2>{modes.length > 1 && <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#898997]">Scorekeeper mode<select value={modeId} onChange={(event) => setModeId(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 text-xs normal-case tracking-normal text-[#f7f0e4]">{modes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name}</option>)}</select></label>}<div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={!gameNightId} onClick={() => setScope('family')} className={`rounded-lg px-3 py-2 text-xs font-bold ${scope === 'family' ? 'bg-[#42d1b1]/15 text-[#42d1b1]' : 'border border-white/10 text-[#a2a2ae]'} disabled:opacity-40`} data-testid="button-leaderboard-family">Family</button><button type="button" disabled={isLocalGame} onClick={() => setScope('global')} className={`rounded-lg px-3 py-2 text-xs font-bold ${scope === 'global' ? 'bg-[#f9be4b]/15 text-[#f9be4b]' : 'border border-white/10 text-[#a2a2ae]'} disabled:opacity-40`} data-testid="button-leaderboard-global">Global</button></div>{!gameNightId && scope === 'family' && <p className="mt-3 text-xs text-[#898997]">Choose a Game Night to see its family leaderboard.</p>}{loading && <p className="mt-4 text-xs text-[#898997]">Loading scores…</p>}{error && <p role="alert" className="mt-4 text-xs text-[#ff9b90]">{error}</p>}{!loading && !error && board?.entries.length ? <ol className="mt-4 space-y-2">{board.entries.map((entry, index) => <li key={entry.id} className="flex items-center gap-3 rounded-xl bg-[#12131a] p-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f9be4b]/10 font-mono text-xs font-bold text-[#f9be4b]">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.username}</p><p className="truncate text-[10px] text-[#777984]">{entry.gameNightName || (scope === 'family' ? 'Family profile' : 'Game Night profile')} · {entry.gamesPlayed} played · {entry.wins} wins</p></div><span className="font-mono text-sm font-bold">{entry.score ?? 'W'}</span></li>)}</ol> : !loading && !error && (scope === 'global' && isLocalGame ? <p className="mt-4 text-xs text-[#898997]">Local games only appear in their Game Night leaderboard.</p> : <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-[#898997]"><Trophy className="mx-auto mb-2 text-[#f9be4b]" size={18} />No scores on this board yet.</div>)}</section>;
}
