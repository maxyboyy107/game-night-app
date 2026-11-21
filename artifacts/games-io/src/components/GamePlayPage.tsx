import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Minus, Trophy, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { finishGameSession, getFamilyGameLeaderboard, getGameLeaderboard, getGameSession } from '@workspace/api-client-react';
import type { GameSession, Leaderboard } from '@workspace/api-client-react';

export function GamePlayPage({ slug, sessionId, signedIn }: { slug: string; sessionId: string; signedIn: boolean }) {
  const [session, setSession] = useState<GameSession>();
  const [leaderboard, setLeaderboard] = useState<Leaderboard>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leaderboardError, setLeaderboardError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [scoreDrafts, setScoreDrafts] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const alive = useRef(true);
  const requestVersion = useRef(0);
  const refreshLeaderboard = async (current: GameSession) => current.gameNightId
    ? getFamilyGameLeaderboard(slug, current.modeId, current.gameNightId)
    : getGameLeaderboard(slug, current.modeId);
  const load = async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError('');
    try {
      const game = await getGameSession(sessionId);
      if (!alive.current || version !== requestVersion.current) return;
      if (game.gameSlug !== slug) throw new Error('This session belongs to another game.');
       setSession(game); setNames(game.players.map((player) => player.name)); setScores(game.players.map((player) => player.score ?? 0)); setScoreDrafts(game.players.map((player) => String(player.score ?? 0))); setSaved(game.status === 'complete'); setNote(game.note || ''); setWinnerIndex(game.players.findIndex((player) => player.isWinner));
       try { const board = await refreshLeaderboard(game); if (alive.current && version === requestVersion.current) { setLeaderboard(board); setLeaderboardError(''); } }
      catch { if (alive.current && version === requestVersion.current) setLeaderboardError('Leaderboard could not be refreshed.'); }
    } catch (cause) { if (alive.current && version === requestVersion.current) setError(cause instanceof Error && cause.message.includes('another game') ? cause.message : 'This saved table could not be loaded.'); }
    finally { if (alive.current && version === requestVersion.current) setLoading(false); }
  };
  useEffect(() => { alive.current = signedIn; if (signedIn) void load(); return () => { alive.current = false; requestVersion.current += 1; }; }, [sessionId, slug, signedIn]);
  const saveResult = async () => {
    if (!session || saved || saving) return;
    setSaving(true); setError('');
    try {
      const result = await finishGameSession(session.id, { note: note.trim() || null, players: session.players.map((player, index) => ({ ...player, name: names[index].trim() || player.name, score: session.strategy === 'winner' ? null : scores[index], isWinner: session.strategy === 'winner' || session.strategy === 'first_to' ? index === winnerIndex : session.scoreDirection === 'lowest' ? scores[index] === Math.min(...scores) : scores[index] === Math.max(...scores) })) });
      if (!alive.current) return;
      setSession(result); setSaved(true);
      try { setLeaderboard(await refreshLeaderboard(result)); setLeaderboardError(''); }
      catch { setLeaderboardError('Score saved; leaderboard refresh failed.'); }
    } catch { if (alive.current) setError('The score could not be saved. Your table is still here; try again.'); }
    finally { if (alive.current) setSaving(false); }
  };
  if (!signedIn) return <section className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-5 text-center" data-testid="status-play-sign-in"><h1 className="text-3xl font-semibold">Sign in to open this saved table.</h1><p className="mt-3 text-sm text-[#898997]">Your game sessions belong to your account.</p><Link href="/sign-in" className="mt-6 rounded-xl bg-[#f9be4b] px-5 py-3 text-sm font-bold text-[#171821]" data-testid="link-play-sign-in">Sign in</Link></section>;
  if (loading) return <section className="mx-auto max-w-[980px] px-5 py-16" data-testid="status-play-loading"><div className="h-32 animate-pulse rounded-3xl bg-white/[0.05]" /><div className="mt-5 h-72 animate-pulse rounded-3xl bg-white/[0.05]" /></section>;
  if (error && !session) return <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 text-center" data-testid="status-play-error"><p className="text-[#ff9b90]">{error}</p><button onClick={() => void load()} className="mt-5 rounded-xl bg-[#f9be4b] px-4 py-2 text-sm font-bold text-[#171821]" data-testid="button-retry-play">Reload saved game</button><Link href={`/game/${slug}`} className="mt-4 text-sm text-[#a2a2ae]" data-testid="link-back-play-guide">Back to guide</Link></section>;
  if (!session) return null;
  const changeScore = (index: number, amount: number) => {
    if (session.strategy === 'winner') return;
    if (session.strategy === 'first_to' && winnerIndex !== null) return;
    const draft = scoreDrafts[index];
    const current = draft && draft !== '-' ? Number(draft) : (scores[index] ?? 0);
    const next = current + amount;
    if (!Number.isSafeInteger(next)) return;
    setScores((currentScores) => currentScores.map((score, i) => i === index ? next : score));
    setScoreDrafts((currentDrafts) => currentDrafts.map((value, i) => i === index ? String(next) : value));
    if (session.strategy === 'first_to' && next >= (session.scorekeeperTarget || 10) && winnerIndex === null) setWinnerIndex(index);
  };
  const setTypedScore = (index: number, value: string) => {
    if (session.strategy === 'first_to' && winnerIndex !== null) return;
    if (!/^-?\d*$/.test(value)) return;
    if (value !== '' && value !== '-') {
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed)) return;
      setScores((current) => current.map((score, i) => i === index ? parsed : score));
      if (session.strategy === 'first_to' && parsed >= (session.scorekeeperTarget || 10) && winnerIndex === null) setWinnerIndex(index);
    }
    setScoreDrafts((current) => current.map((draft, i) => i === index ? value : draft));
  };
  const settleScoreDraft = (index: number) => {
    const value = scoreDrafts[index];
    if (value === '' || value === '-') {
   const normalized = String(scores[index] ?? 0);
      setScoreDrafts((current) => current.map((draft, i) => i === index ? normalized : draft));
      setScores((current) => current.map((score, i) => i === index ? Number(normalized) : score));
    }
  };
  return <section className="page-enter mx-auto max-w-[980px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14" data-testid="page-game-play">
    <Link href={`/game/${slug}`} className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[#a2a2ae] hover:text-[#f9be4b]" data-testid="link-play-back-guide"><ArrowLeft size={16} /> Back to guide</Link>
     <div className="grid gap-8 lg:grid-cols-[1fr_310px]"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#42d1b1]">{saved ? 'Completed table' : 'Live scorekeeper'}</p><h1 className="mt-3 text-5xl font-semibold tracking-[-0.08em]" data-testid="text-play-game-title">{session.gameTitle || slug}</h1><p className="mt-3 text-sm text-[#898997]" data-testid="text-play-session-status">{session.modeName} · {new Date(session.playedAt || session.startedAt).toLocaleDateString()} · {saved ? 'Saved' : 'In progress'}</p>
         {!saved && <label className="mt-6 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#898997]">Table note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Leave a note for your family history…" className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-[#12131a] px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-[#f7f0e4] outline-none placeholder:text-[#777984] focus:border-[#f9be4b]/50" data-testid="input-play-note" /></label>}
          {session.variation && <p className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#c2c0c0]">Variation · {session.variation}</p>}
          {session.strategy === 'first_to' && <p className="mt-3 rounded-xl border border-[#f9be4b]/20 bg-[#302718]/35 px-3 py-2 text-xs text-[#f9be4b]">First to {session.scorekeeperTarget || 10} points wins{winnerIndex !== null ? ` · ${names[winnerIndex]} reached the target` : ''}.</p>}
          <div className="mt-8 space-y-3">{session.players.map((player, index) => <article key={`${index}-${player.name}`} className={`rounded-2xl border p-4 sm:p-5 ${player.isYou ? 'border-[#f9be4b]/35 bg-[#302718]/45' : 'border-white/[0.09] bg-[#171821]/75'}`} data-testid={`card-play-player-${index}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#777984]">{player.isYou ? 'Your score' : player.gameNightProfileId ? 'Family profile score' : player.familyMemberId ? 'Family profile score' : `Guest · Player ${index + 1}`}</label><input value={names[index] || ''} disabled={saved || Boolean(player.familyMemberId || player.gameNightProfileId)} onChange={(event) => setNames((current) => current.map((name, i) => i === index ? event.target.value : name))} className="w-full bg-transparent text-lg font-semibold outline-none disabled:text-[#c2c0c0]" aria-label={`Player ${index + 1} name`} data-testid={`input-play-player-name-${index}`} />{(player.familyMemberId || player.gameNightProfileId) && <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#42d1b1]" data-testid={`text-play-family-member-${index}`}>Saved family profile</p>}</div>{session.strategy === 'winner' ? <button type="button" disabled={saved} onClick={() => setWinnerIndex(winnerIndex === index ? null : index)} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${winnerIndex === index ? 'bg-[#f9be4b] text-[#171821]' : 'border border-white/10 text-[#a2a2ae]'} disabled:opacity-50`} data-testid={`button-play-winner-${index}`}><UserRound size={15} /> {winnerIndex === index ? 'Winner' : 'Mark winner'}</button> : <div className="flex flex-wrap items-center gap-2"><button disabled={saved} onClick={() => changeScore(index, -1)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07] text-[#a2a2ae] disabled:opacity-30" aria-label={`Subtract point from ${names[index]}`} data-testid={`button-play-minus-${index}`}><Minus size={17} /></button><input value={scoreDrafts[index] ?? String(scores[index])} disabled={saved} onChange={(event) => setTypedScore(index, event.target.value)} onBlur={() => settleScoreDraft(index)} inputMode="numeric" pattern="-?[0-9]*" className="h-12 w-[5.5rem] rounded-xl border border-[#f9be4b]/20 bg-[#12131a] px-2 text-center font-mono text-2xl font-bold text-[#f9be4b] outline-none focus:border-[#f9be4b]/60 disabled:opacity-60" aria-label={`Score for ${names[index]}`} data-testid={`input-play-score-${index}`} />{[1, 5, 10, 50, 100].map((amount) => <button key={amount} disabled={saved} onClick={() => changeScore(index, amount)} className={`min-w-9 rounded-lg px-2 py-2 text-xs font-bold transition-colors disabled:opacity-30 ${amount === 1 ? 'bg-[#f9be4b] text-[#171821]' : 'border border-white/10 bg-white/[0.05] text-[#c2c0c0] hover:border-[#f9be4b]/40 hover:text-[#f9be4b]'}`} aria-label={`Add ${amount} points to ${names[index]}`} data-testid={`button-play-plus-${amount}-${index}`}>+{amount}</button>)}</div>}</div></article>)}</div>
      {error && <p role="alert" className="mt-4 text-sm text-[#ff9b90]" data-testid="status-play-save-error">{error}</p>}
        {saved ? <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#42d1b1]/25 bg-[#42d1b1]/[0.07] p-4 text-sm text-[#42d1b1]" data-testid="status-play-saved"><Check size={16} /> Final result saved{session.winnerName ? ` · ${session.winnerName} won` : ''}</div> : <button onClick={() => void saveResult()} disabled={saving || ((session.strategy === 'winner' || session.strategy === 'first_to') && winnerIndex === null)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f9be4b] py-4 text-sm font-bold text-[#171821] disabled:opacity-50" data-testid="button-finish-game">{saving ? 'Saving final result…' : 'Finish and save game'} <Check size={16} /></button>}
    </div>
     <aside className="rounded-2xl border border-white/[0.09] bg-[#171821]/75 p-5" data-testid="panel-leaderboard"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f9be4b]">Hall of the table</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Leaderboard</h2><p className="mt-1 text-xs text-[#898997]">{session.modeName}</p>{leaderboardError && <p className="mt-3 text-xs text-[#ff9b90]" role="alert" data-testid="status-leaderboard-error">{leaderboardError}</p>}{leaderboard?.entries.length ? <ol className="mt-5 space-y-2">{leaderboard.entries.map((entry, index) => <li key={`${entry.id}-${index}`} className="flex items-center gap-3 rounded-xl bg-[#12131a] p-3" data-testid={`row-leaderboard-${index}`}><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f9be4b]/10 font-mono text-xs font-bold text-[#f9be4b]">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.username}</p><p className="text-[10px] text-[#777984]">{entry.familyMemberId ? 'Family profile' : 'Account'} · {entry.gamesPlayed} played · {entry.wins} wins</p></div><span className="font-mono font-bold">{entry.score ?? 'W'}</span></li>)}</ol> : leaderboardError ? <button onClick={() => { setLeaderboardError(''); void getGameLeaderboard(slug, session.modeId).then(setLeaderboard).catch(() => setLeaderboardError('Leaderboard could not be refreshed.')); }} className="mt-4 text-xs font-semibold text-[#f9be4b]" data-testid="button-retry-leaderboard">Try leaderboard again</button> : <div className="mt-5 rounded-xl border border-dashed border-white/15 px-4 py-7 text-center text-sm text-[#898997]" data-testid="empty-leaderboard"><Trophy className="mx-auto mb-3 text-[#f9be4b]" size={21} />No scores on the board yet.</div>}</aside></div>
  </section>;
}