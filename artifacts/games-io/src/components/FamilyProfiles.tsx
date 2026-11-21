import { useEffect, useState } from 'react';
import { Archive, Check, Clock3, UserRoundPlus, Users, RotateCcw, Trophy, Undo2 } from 'lucide-react';
import { createFamilyMember, getFamilyMemberHistory, updateFamilyMember } from '@workspace/api-client-react';
import type { FamilyMember, FamilyMemberHistory, GameSession } from '@workspace/api-client-react';
import type { Game } from '../data/games';

export function FamilyProfiles({ members, games, onChanged }: { members: FamilyMember[]; games: Game[]; onChanged: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState(members[0]?.id || '');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const [busyId, setBusyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<FamilyMemberHistory>();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const activeSelectedId = members.some((member) => member.id === selectedId) ? selectedId : (members[0]?.id || '');
  const selectedMember = members.find((member) => member.id === activeSelectedId);
  const refreshProfile = async () => {
    await onChanged();
  };
  useEffect(() => {
    let current = true;
    if (!activeSelectedId) {
      setHistory(undefined);
      setHistoryLoading(false);
      setHistoryError(false);
      return () => { current = false; };
    }
    setHistoryLoading(true);
    setHistoryError(false);
    void getFamilyMemberHistory(activeSelectedId).then((result) => {
      if (current) setHistory(result);
    }).catch(() => {
      if (current) setHistoryError(true);
    }).finally(() => {
      if (current) setHistoryLoading(false);
    });
    return () => { current = false; };
  }, [activeSelectedId]);
  const addMember = async () => {
    const name = newName.trim();
    if (!name || name.length > 32) { setError('Enter a name between 1 and 32 characters.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await createFamilyMember({ name });
      setNewName('');
      setSelectedId(created.id);
      await refreshProfile();
      setNotice(`${created.name} is ready to join a table.`);
    } catch { setError('Could not add this family profile. Try again.'); }
    finally { setBusy(false); }
  };
  const saveRename = async (member: FamilyMember) => {
    const name = editName.trim();
    if (!name || name.length > 32) { setError('Enter a name between 1 and 32 characters.'); return; }
    setBusyId(member.id); setError(''); setNotice('');
    try {
      await updateFamilyMember(member.id, { name });
      setEditingId('');
      await refreshProfile();
      setNotice('Family profile name saved.');
    } catch { setError('That family profile name could not be saved.'); }
    finally { setBusyId(''); }
  };
  const toggleActive = async (member: FamilyMember) => {
    setBusyId(member.id); setError(''); setNotice('');
    try {
      await updateFamilyMember(member.id, { isActive: !member.isActive });
      await refreshProfile();
      setNotice(`${member.name} ${member.isActive ? 'archived' : 'restored'}.`);
    } catch { setError(`Could not ${member.isActive ? 'archive' : 'restore'} this family profile.`); }
    finally { setBusyId(''); }
  };
  const gameTitle = (slug: string, fallback?: string) => games.find((game) => game.slug === slug)?.title || fallback || slug;
  const sessionRow = (session: GameSession) => {
    const memberScore = session.players.find((player) => player.familyMemberId === selectedMember?.id)?.score;
    return <div key={session.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#12131a] p-3" data-testid={`row-family-game-${session.id}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#42d1b1]/10 text-[#42d1b1]"><Clock3 size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{gameTitle(session.gameSlug, session.gameTitle)}</p><p className="mt-1 text-xs text-[#777984]">{session.finishedAt ? new Date(session.finishedAt).toLocaleDateString() : 'Completed game'} · {session.players.length} players</p></div><span className="font-mono text-sm font-bold text-[#f9be4b]" data-testid={`text-family-game-score-${session.id}`}>{memberScore ?? '—'}</span></div>;
  };

  return <section className="mt-12 border-t border-white/[0.09] pt-9" data-testid="section-family-profiles">
    <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#42d1b1]">Your people, one account</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Family profiles</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#898997]">Keep each player’s record together. Family profiles are not separate logins and can be added to future tables while active.</p></div><form className="flex w-full gap-2 sm:max-w-sm" onSubmit={(event) => { event.preventDefault(); void addMember(); }}><input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={32} placeholder="Add a family member" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#12131a] px-3 text-sm outline-none focus:border-[#f9be4b]/60" aria-label="New family profile name" data-testid="input-add-family-member" /><button type="submit" disabled={busy || !newName.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f9be4b] text-[#171821] disabled:opacity-45" aria-label="Add family profile" data-testid="button-add-family-member"><UserRoundPlus size={17} /></button></form></div>
    {error && <p className="mb-3 rounded-xl border border-[#ff9b90]/20 bg-[#ff9b90]/[0.06] px-4 py-3 text-sm text-[#ff9b90]" role="alert" data-testid="status-family-error">{error}</p>}
    {notice && <p className="mb-3 text-xs text-[#42d1b1]" role="status" data-testid="status-family-feedback">{notice}</p>}
    {members.length ? <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2" aria-label="Family profiles">
        {members.map((member) => <article key={member.id} className={`rounded-2xl border p-4 ${activeSelectedId === member.id ? 'border-[#42d1b1]/35 bg-[#12201e]/65' : 'border-white/[0.08] bg-[#171821]/70'}`} data-testid={`card-family-member-${member.id}`}>
          <button type="button" onClick={() => setSelectedId(member.id)} className="flex w-full items-center gap-3 text-left" data-testid={`button-select-family-member-${member.id}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-semibold ${member.isActive ? 'bg-[#42d1b1]/10 text-[#42d1b1]' : 'bg-white/[0.06] text-[#898997]'}`}>{member.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{member.name}</span><span className={`mt-1 block text-[10px] font-bold uppercase tracking-[0.12em] ${member.isActive ? 'text-[#42d1b1]' : 'text-[#898997]'}`}>{member.isActive ? 'Active profile' : 'Archived · history kept'}</span></span></button>
          {editingId === member.id ? <div className="mt-3 space-y-2"><input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={32} autoFocus className="h-10 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 text-sm outline-none focus:border-[#f9be4b]/60" aria-label={`Rename ${member.name}`} data-testid={`input-rename-family-${member.id}`} /><div className="flex gap-2"><button type="button" onClick={() => void saveRename(member)} disabled={busyId === member.id} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#f9be4b] px-3 py-2 text-xs font-bold text-[#171821] disabled:opacity-50" data-testid={`button-save-family-name-${member.id}`}><Check size={13} /> Save</button><button type="button" onClick={() => setEditingId('')} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#a2a2ae]" data-testid={`button-cancel-family-name-${member.id}`}>Cancel</button></div></div> : <div className="mt-3 flex gap-2"><button type="button" onClick={() => { setEditingId(member.id); setEditName(member.name); setError(''); }} className="flex-1 rounded-lg border border-white/10 px-2 py-2 text-xs font-semibold text-[#c2c0c0] hover:border-[#f9be4b]/40" data-testid={`button-rename-family-${member.id}`}>Rename</button><button type="button" onClick={() => void toggleActive(member)} disabled={busyId === member.id} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-2 text-xs font-semibold text-[#a2a2ae] hover:border-[#ff9b90]/40 hover:text-[#ff9b90] disabled:opacity-50" data-testid={`button-toggle-family-${member.id}`}>{member.isActive ? <><Archive size={13} /> Archive</> : <><Undo2 size={13} /> Restore</>}</button></div>}
        </article>)}
      </div>
      {selectedMember && <div className="rounded-2xl border border-white/[0.08] bg-[#171821]/70 p-5 sm:p-6" data-testid={`panel-family-history-${selectedMember.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#777984]">Player record</p><h3 className="mt-1 text-2xl font-semibold tracking-[-0.05em]">{selectedMember.name}</h3>{!selectedMember.isActive && <p className="mt-1 text-xs text-[#898997]">Archived profiles keep their history but cannot join a new game.</p>}</div><span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#898997]"><Users size={12} /> Subprofile</span></div>
        {historyLoading ? <div className="mt-5 grid gap-2 sm:grid-cols-3"><div className="h-20 animate-pulse rounded-xl bg-white/[0.05]" /><div className="h-20 animate-pulse rounded-xl bg-white/[0.05]" /><div className="h-20 animate-pulse rounded-xl bg-white/[0.05]" /></div>
        : historyError ? <div className="mt-5 rounded-xl border border-dashed border-white/15 px-4 py-6 text-sm text-[#a2a2ae]" data-testid="status-family-history-error"><p>History could not be loaded.</p><button type="button" onClick={() => {
          setHistoryLoading(true); setHistoryError(false);
          void getFamilyMemberHistory(activeSelectedId).then(setHistory).catch(() => setHistoryError(true)).finally(() => setHistoryLoading(false));
        }} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#f9be4b]" data-testid="button-retry-family-history"><RotateCcw size={13} /> Try again</button></div>
        : history ? <>
          <div className="mt-5 grid grid-cols-3 gap-2">{[
            { label: 'Games played', value: history.stats.gamesPlayed, Icon: Clock3 },
            { label: 'Wins', value: history.stats.wins, Icon: Trophy },
            { label: 'High score', value: history.stats.highScore, Icon: Check },
          ].map(({ label, value, Icon }) => <div key={label} className="rounded-xl border border-white/[0.07] bg-[#12131a] p-3" data-testid={`stat-family-${label.toLowerCase().replaceAll(' ', '-')}-${selectedMember.id}`}><Icon size={15} className="text-[#f9be4b]" /><p className="mt-2 font-mono text-xl font-bold">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#777984]">{label}</p></div>)}</div>
          <div className="mt-6"><div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#a2a2ae]">Recent completed games</h4><span className="font-mono text-[10px] text-[#777984]">{history.recentGames.length} shown</span></div>{history.recentGames.length ? <div className="space-y-2">{history.recentGames.map(sessionRow)}</div> : <div className="rounded-xl border border-dashed border-white/15 px-4 py-7 text-center text-sm text-[#898997]" data-testid={`empty-family-history-${selectedMember.id}`}>Their first completed table will appear here.</div>}</div>
        </> : null}
      </div>}
    </div> : <div className="rounded-2xl border border-dashed border-white/15 bg-[#171821]/40 px-5 py-8 text-center" data-testid="empty-family-profiles"><Users className="mx-auto text-[#42d1b1]" size={22} /><p className="mt-3 text-sm font-semibold">No family profiles yet.</p><p className="mt-1 text-xs text-[#898997]">Add someone to keep their game history alongside yours.</p></div>}
  </section>;
}