import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Download, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { createHistoricalGame, deleteGameSession, exportProfileBackup, getProfileGames, restoreProfileBackup, updateGameSession } from '@workspace/api-client-react';
import type { FamilyMember, GameSession, ProfileBackup, SessionPlayer } from '@workspace/api-client-react';
import type { Game } from '../data/games';

type DraftPlayer = { name: string; score: string; isYou: boolean; familyMemberId: string | null; isWinner: boolean };
type Draft = { id?: string; gameSlug: string; modeId: string; playedAt: string; variation: string; note: string; players: DraftPlayer[] };
const localDate = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const initialDraft = (gameSlug: string): Draft => ({ gameSlug, modeId: '', playedAt: localDate(), variation: '', note: '', players: [{ name: '', score: '0', isYou: true, familyMemberId: null, isWinner: false }, { name: '', score: '0', isYou: false, familyMemberId: null, isWinner: false }] });
function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export function SessionHistory({ games, familyMembers, onChanged }: { games: Game[]; familyMembers: FamilyMember[]; onChanged: () => Promise<void> }) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(games[0]?.slug || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const activeFamily = familyMembers.filter((member) => member.isActive);
  const selectedGame = games.find((game) => game.slug === draft.gameSlug);
  const modes = selectedGame?.scorekeeperModes?.length ? selectedGame.scorekeeperModes : [{ id: 'points', name: 'Points game', strategy: 'points' as const, direction: 'highest' as const }, { id: 'winner', name: 'Who won?', strategy: 'winner' as const }];
  const selectedMode = modes.find((mode) => mode.id === draft.modeId) || modes[0];
  const refresh = async () => {
    setLoadError('');
    try {
      const result = await getProfileGames();
      setSessions(result.games);
    } catch { setLoadError('Game history could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const openCreate = () => {
    const fresh = initialDraft(games[0]?.slug || '');
    fresh.modeId = games[0]?.scorekeeperModes?.[0]?.id || 'points';
    setDraft(fresh); setError(''); setDialog(true);
  };
  const openEdit = (session: GameSession) => {
    const game = games.find((entry) => entry.slug === session.gameSlug);
    setDraft({
      id: session.id, gameSlug: session.gameSlug, modeId: session.modeId, playedAt: localDate(session.playedAt),
      variation: session.variation || '', note: session.note || '',
      players: session.players.map((player) => ({ name: player.name, score: player.score === null ? '' : String(player.score), isYou: player.isYou, familyMemberId: player.familyMemberId, isWinner: player.isWinner })),
    });
    if (!game) setError('This game is no longer in the current catalog.');
    else setError('');
    setDialog(true);
  };
  const setPlayer = (index: number, patch: Partial<DraftPlayer>) => setDraft((current) => ({ ...current, players: current.players.map((player, i) => i === index ? { ...player, ...patch } : player) }));
  const save = async () => {
    if (!selectedMode || !draft.gameSlug || draft.players.length < 2) { setError('Choose a game and add at least two players.'); return; }
    if (draft.players.some((player) => !player.name.trim())) { setError('Give every player a name.'); return; }
    if (selectedMode.strategy === 'winner' && draft.players.filter((player) => player.isWinner).length !== 1) { setError('Select exactly one winner.'); return; }
    if (new Set(draft.players.map((player) => player.familyMemberId).filter(Boolean)).size !== draft.players.filter((player) => player.familyMemberId).length) { setError('A family profile can only be at the table once.'); return; }
    if (draft.players.filter((player) => player.isYou).length > 1) { setError('Only one player can be marked as you.'); return; }
    const scoreValues = draft.players.map((player) => Number(player.score || 0));
    if (selectedMode.strategy === 'points' && scoreValues.some((score) => !Number.isSafeInteger(score))) { setError('Scores must be whole numbers.'); return; }
    const winningScore = selectedMode.strategy === 'points'
      ? selectedMode.direction === 'lowest' ? Math.min(...scoreValues) : Math.max(...scoreValues)
      : null;
    const players: SessionPlayer[] = draft.players.map((player) => ({
      name: player.name.trim(),
      score: selectedMode.strategy === 'winner' ? null : Number(player.score || 0),
      isYou: player.isYou,
      familyMemberId: player.familyMemberId,
      isWinner: selectedMode.strategy === 'winner' ? player.isWinner : Number(player.score || 0) === winningScore,
    }));
    setBusy(true); setError(''); setNotice('');
    const payload = { gameSlug: draft.gameSlug, modeId: draft.modeId, playedAt: new Date(`${draft.playedAt}T12:00:00`).toISOString(), players, variation: draft.variation || null, note: draft.note.trim() || null };
    try {
      if (draft.id) await updateGameSession(draft.id, payload);
      else await createHistoricalGame(payload);
      setDialog(false); setNotice(draft.id ? 'History entry updated.' : 'Past game added to your history.');
      await refresh();
      await onChanged();
    } catch { setError('This history entry could not be saved. Check the details and try again.'); }
    finally { setBusy(false); }
  };
  const remove = async (session: GameSession) => {
    if (!window.confirm(`Delete the ${session.gameTitle || session.gameSlug} history entry? This cannot be undone.`)) return;
    setNotice(''); setError('');
    try { await deleteGameSession(session.id); setSessions((items) => items.filter((item) => item.id !== session.id)); setNotice('History entry deleted.'); await onChanged(); }
    catch { setError('That history entry could not be deleted.'); }
  };
  const exportBackup = async () => {
    setBackupBusy(true); setBackupError('');
    try { const backup = await exportProfileBackup(); downloadJson('games-io-profile-backup.json', backup); setNotice('Profile backup downloaded.'); }
    catch { setBackupError('Profile backup could not be exported.'); }
    finally { setBackupBusy(false); }
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    setBackupBusy(true); setBackupError('');
    try {
      const backup = JSON.parse(await file.text()) as ProfileBackup;
      if (backup.schemaVersion !== 1 || !backup.accountId || !Array.isArray(backup.games) || !Array.isArray(backup.familyMembers)) throw new Error('Invalid backup');
      if (!window.confirm('Restore this backup to the signed-in account? It replaces this account’s profile data and history.')) return;
      await restoreProfileBackup(backup);
      setNotice('Profile backup restored.'); await refresh();
      await onChanged();
    } catch { setBackupError('This backup could not be restored. Confirm it is a valid games.io profile backup for this account.'); }
    finally { setBackupBusy(false); if (importRef.current) importRef.current.value = ''; }
  };
  const dateText = (value: string) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return <section className="mt-12 border-t border-white/[0.09] pt-9" data-testid="section-profile-history">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e9a4cc]">The family ledger</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em]">Every table, remembered.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#898997]">Add a past game by hand, or edit and remove entries from the account history.</p></div><button type="button" onClick={openCreate} className="flex items-center justify-center gap-2 rounded-xl bg-[#f9be4b] px-4 py-3 text-sm font-bold text-[#171821]" data-testid="button-add-historical-game"><Plus size={16} /> Add past game</button></div>
    <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-white/[0.08] bg-[#171821]/55 p-4">
      <button type="button" onClick={() => void exportBackup()} disabled={backupBusy} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#c2c0c0] hover:border-[#42d1b1]/50 hover:text-[#42d1b1] disabled:opacity-50" data-testid="button-profile-export"><Download size={14} /> {backupBusy ? 'Working…' : 'Export profile backup'}</button>
      <button type="button" onClick={() => importRef.current?.click()} disabled={backupBusy} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#c2c0c0] hover:border-[#42d1b1]/50 hover:text-[#42d1b1] disabled:opacity-50" data-testid="button-profile-import"><Upload size={14} /> Import profile backup</button>
      <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importBackup(event.target.files?.[0])} aria-label="Import profile backup file" />
      <p className="basis-full text-[11px] leading-5 text-[#777984]">Backups include your profile, family profiles, favorites, and game history. Restore is limited to the account that created the export.</p>
    </div>
    {notice && <p role="status" className="mt-3 text-xs text-[#42d1b1]" data-testid="status-history-notice">{notice}</p>}
    {(error || backupError) && <p role="alert" className="mt-3 text-xs text-[#ff9b90]" data-testid="status-history-error">{error || backupError}</p>}
    {loading ? <div className="mt-5 space-y-2" aria-label="Loading table history"><div className="h-20 animate-pulse rounded-xl bg-white/[0.05]" /><div className="h-20 animate-pulse rounded-xl bg-white/[0.05]" /></div>
      : loadError ? <div className="mt-5 rounded-xl border border-dashed border-white/15 p-6 text-sm text-[#a2a2ae]">{loadError}<button onClick={() => void refresh()} className="ml-3 font-semibold text-[#f9be4b]" data-testid="button-retry-history">Try again</button></div>
        : sessions.length ? <div className="mt-5 space-y-2">{sessions.map((session) => <article key={session.id} className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#171821]/70 p-4 sm:flex-row sm:items-center" data-testid={`row-history-session-${session.id}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9a4cc]/10 text-[#e9a4cc]"><CalendarDays size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{session.gameTitle || games.find((game) => game.slug === session.gameSlug)?.title || session.gameSlug}</h3><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#898997]">{session.source}</span></div><p className="mt-1 text-xs text-[#898997]">{dateText(session.playedAt)} · {session.modeName} · {session.players.map((player) => player.name).join(', ')}</p><p className="mt-1 text-xs text-[#a2a2ae]">{session.winnerName ? `${session.winnerName} won` : session.score !== null ? `Table score ${session.score}` : 'Result recorded'}{session.variation ? ` · ${session.variation}` : ''}{session.note ? ` · ${session.note}` : ''}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => openEdit(session)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#c2c0c0] hover:border-[#f9be4b]/50 hover:text-[#f9be4b]" aria-label={`Edit ${session.gameTitle || session.gameSlug}`} data-testid={`button-edit-history-${session.id}`}><Pencil size={13} /> Edit</button><button type="button" onClick={() => void remove(session)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#898997] hover:border-[#ff9b90]/40 hover:text-[#ff9b90]" aria-label={`Delete ${session.gameTitle || session.gameSlug}`} data-testid={`button-delete-history-${session.id}`}><Trash2 size={14} /></button></div></article>)}</div>
        : <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-[#171821]/40 px-5 py-9 text-center"><p className="text-sm font-semibold">The ledger is open.</p><p className="mt-1 text-xs text-[#898997]">Record your first past table or finish a live game.</p></div>}
    {dialog && <div className="fixed inset-0 z-40 grid place-items-center bg-[#090a0e]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={draft.id ? 'Edit historical game' : 'Add historical game'} data-testid="dialog-historical-game"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#171821] p-5 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e9a4cc]">Family archive</p><h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{draft.id ? 'Edit a table' : 'Add a past table'}</h3></div><button onClick={() => setDialog(false)} className="grid h-9 w-9 place-items-center rounded-lg text-[#898997] hover:bg-white/5" aria-label="Close editor"><X size={17} /></button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#898997]">Game<select value={draft.gameSlug} onChange={(event) => { const game = games.find((entry) => entry.slug === event.target.value); setDraft((current) => ({ ...current, gameSlug: event.target.value, modeId: game?.scorekeeperModes?.[0]?.id || 'points', variation: '' })); }} className="admin-input mt-2 w-full" data-testid="select-history-game">{games.map((game) => <option key={game.slug} value={game.slug}>{game.title}</option>)}</select></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#898997]">Played on<input type="date" value={draft.playedAt} onChange={(event) => setDraft((current) => ({ ...current, playedAt: event.target.value }))} className="admin-input mt-2 w-full" data-testid="input-history-date" /></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#898997]">Scorekeeper mode<select value={draft.modeId || modes[0]?.id} onChange={(event) => setDraft((current) => ({ ...current, modeId: event.target.value, players: current.players.map((player) => ({ ...player, isWinner: false })) }))} className="admin-input mt-2 w-full" data-testid="select-history-mode">{modes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name} · {mode.strategy === 'winner' ? 'winner only' : `${mode.direction === 'lowest' ? 'lowest' : 'highest'} points win`}</option>)}</select></label>
        {selectedGame?.variations?.length ? <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#898997]">Variation<select value={draft.variation} onChange={(event) => setDraft((current) => ({ ...current, variation: event.target.value }))} className="admin-input mt-2 w-full" data-testid="select-history-variation"><option value="">Standard rules</option>{selectedGame.variations.map((variation) => <option key={variation} value={variation}>{variation}</option>)}</select></label> : null}</div>
      <div className="mt-5 flex items-center justify-between"><div><p className="text-sm font-semibold">Players at the table</p><p className="mt-1 text-xs text-[#898997]">{selectedMode?.strategy === 'winner' ? 'Mark the player who won.' : `Record the ${selectedMode?.direction === 'lowest' ? 'lowest' : 'highest'} score.`}</p></div><button type="button" disabled={draft.players.length >= 8} onClick={() => setDraft((current) => ({ ...current, players: [...current.players, { name: '', score: '0', isYou: false, familyMemberId: null, isWinner: false }] }))} className="flex items-center gap-1 text-xs font-semibold text-[#42d1b1] disabled:opacity-40" data-testid="button-add-history-player"><Plus size={14} /> Add player</button></div>
      <div className="mt-3 space-y-2">{draft.players.map((player, index) => <div key={index} className="grid gap-2 rounded-xl border border-white/[0.08] bg-[#12131a] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center" data-testid={`row-history-player-${index}`}><div><label className="mb-1 block text-[9px] font-bold uppercase tracking-[0.1em] text-[#777984]">Player name</label><input value={player.name} onChange={(event) => setPlayer(index, { name: event.target.value, familyMemberId: null })} maxLength={32} list={`family-members-${index}`} className="admin-input w-full" aria-label={`History player ${index + 1} name`} data-testid={`input-history-player-${index}`} /><datalist id={`family-members-${index}`}>{activeFamily.map((member) => <option key={member.id} value={member.name} />)}</datalist></div><div><label className="mb-1 block text-[9px] font-bold uppercase tracking-[0.1em] text-[#777984]">Profile / result</label><div className="flex gap-2"><select value={player.familyMemberId ? `family:${player.familyMemberId}` : player.isYou ? 'you' : 'guest'} onChange={(event) => { const value = event.target.value; const family = activeFamily.find((member) => member.id === value.slice(7)); setPlayer(index, value === 'you' ? { isYou: true, familyMemberId: null } : family ? { name: family.name, isYou: false, familyMemberId: family.id } : { isYou: false, familyMemberId: null }); }} className="admin-input min-w-0 flex-1" aria-label={`History player ${index + 1} profile`} data-testid={`select-history-player-type-${index}`}><option value="guest">Guest</option><option value="you">You</option>{activeFamily.map((member) => <option key={member.id} value={`family:${member.id}`}>{member.name} · family</option>)}</select>{selectedMode?.strategy === 'winner' ? <button type="button" onClick={() => setDraft((current) => ({ ...current, players: current.players.map((entry, i) => ({ ...entry, isWinner: i === index })) }))} className={`rounded-lg px-3 text-xs font-bold ${player.isWinner ? 'bg-[#f9be4b] text-[#171821]' : 'border border-white/10 text-[#898997]'}`} data-testid={`button-history-winner-${index}`}>{player.isWinner ? 'Winner' : 'Mark win'}</button> : <input type="number" step="1" value={player.score} onChange={(event) => setPlayer(index, { score: event.target.value })} className="admin-input w-24 text-center font-mono" aria-label={`Score for ${player.name || `player ${index + 1}`}`} data-testid={`input-history-score-${index}`} />}</div></div><button type="button" disabled={draft.players.length <= 2} onClick={() => setDraft((current) => ({ ...current, players: current.players.filter((_, i) => i !== index) }))} className="justify-self-end rounded-lg p-2 text-[#777984] hover:text-[#ff9b90] disabled:opacity-30" aria-label={`Remove player ${index + 1}`}><Trash2 size={14} /></button></div>)}</div>
      <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#898997]">Table note<textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} maxLength={1000} placeholder="What should the family remember?" className="admin-input mt-2 min-h-20 w-full resize-y font-sans text-sm normal-case tracking-normal" data-testid="input-history-note" /></label>
      {error && <p className="mt-3 text-sm text-[#ff9b90]" role="alert" data-testid="status-history-form-error">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDialog(false)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-[#a2a2ae]">Cancel</button><button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-[#f9be4b] px-5 py-3 text-sm font-bold text-[#171821] disabled:opacity-50" data-testid="button-save-history">{busy ? 'Saving…' : draft.id ? 'Save changes' : 'Add to history'}</button></div>
    </div></div>}
  </section>;
}
