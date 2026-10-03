import { useState } from 'react';
import { ArrowRight, Plus, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getProfile, startGameSession } from '@workspace/api-client-react';
import type { FamilyMember } from '@workspace/api-client-react';

export function StartGameButton({ slug, title, signedIn, username }: { slug: string; title: string; signedIn: boolean; username: string }) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [accountName, setAccountName] = useState(username || 'You');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [players, setPlayers] = useState<{ name: string; familyMemberId: string | null }[]>([{ name: 'Player 2', familyMemberId: null }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeMembers = familyMembers.filter((member) => member.isActive);
  const openDialog = () => {
    setOpen(true);
    setError('');
    void getProfile().then((profile) => {
      setAccountName(profile.username);
      setFamilyMembers(profile.familyMembers || []);
    }).catch(() => setError('Family profiles could not be loaded. You can still add guest names.'));
  };
  const begin = async () => {
    if (!signedIn) return;
    const playerInputs = [
      { name: accountName.trim() || 'You', isYou: true, familyMemberId: null },
      ...players.map((player) => ({ name: player.name.trim(), isYou: false, familyMemberId: player.familyMemberId })),
    ];
    if (playerInputs.some((player) => !player.name)) { setError('Give every guest a name first.'); return; }
    if (new Set(players.map((player) => player.familyMemberId).filter(Boolean)).size !== players.filter((player) => player.familyMemberId).length) {
      setError('A family profile can only be at the table once.');
      return;
    }
    setBusy(true); setError('');
    try {
      const session = await startGameSession(slug, { players: playerInputs });
      setLocation(`/game/${slug}/play/${session.id}`);
    } catch { setError('Could not start this saved game. Try again.'); }
    finally { setBusy(false); }
  };
  return <>
    {signedIn ? <button type="button" onClick={openDialog} className="pressable flex items-center gap-2 rounded-xl bg-[#f9be4b] px-4 py-3 text-sm font-bold text-[#171821] hover:bg-[#ffd47e]" data-testid={`button-start-game-${slug}`}><ArrowRight size={16} /> Start game</button> : <Link href="/sign-in" className="pressable flex items-center gap-2 rounded-xl bg-[#f9be4b] px-4 py-3 text-sm font-bold text-[#171821]" data-testid={`link-start-game-sign-in-${slug}`}>Sign in to start a saved game <ArrowRight size={16} /></Link>}
    {open && <div className="fixed inset-0 z-40 grid place-items-center bg-[#090a0e]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Start ${title}`} data-testid="dialog-start-game">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#171821] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#42d1b1]">New table</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Who is playing {title}?</h2></div><button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-[#898997] hover:bg-white/5" aria-label="Close" data-testid="button-close-start-game"><X size={17} /></button></div>
        <div className="mt-5 rounded-xl border border-[#f9be4b]/20 bg-[#302718]/35 p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f9be4b]">Account holder · included once</p><p className="mt-1 text-sm font-semibold">{accountName || 'You'} <span className="ml-1 text-[10px] font-mono text-[#898997]">YOU</span></p></div>
        <div className="mt-3 space-y-2">{players.map((player, index) => {
          const selectedMember = activeMembers.find((member) => member.id === player.familyMemberId);
          const alreadyChosen = new Set(players.filter((entry, i) => i !== index).map((entry) => entry.familyMemberId).filter(Boolean));
          return <div key={index} className="rounded-xl border border-white/[0.08] bg-[#12131a] p-3" data-testid={`row-start-player-${index + 1}`}>
            <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#777984]">Player {index + 2}</span><button onClick={() => setPlayers((current) => current.filter((_, i) => i !== index))} aria-label={`Remove player ${index + 2}`} className="text-[#777984] hover:text-[#ff9b90]" data-testid={`button-remove-start-player-${index + 1}`}><X size={15} /></button></div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#898997]">Player type</label>
            <select value={player.familyMemberId ? `family:${player.familyMemberId}` : 'guest'} onChange={(event) => {
              const value = event.target.value;
              const member = value.startsWith('family:') ? activeMembers.find((item) => item.id === value.slice(7)) : undefined;
              setPlayers((current) => current.map((entry, i) => i === index ? { name: member?.name || '', familyMemberId: member?.id || null } : entry));
            }} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-[#171821] px-3 text-sm text-[#f7f0e4] outline-none focus:border-[#f9be4b]/50" aria-label={`Player ${index + 2} type`} data-testid={`select-start-player-type-${index}`}>
              <option value="guest">Guest name</option>
              {activeMembers.filter((member) => !alreadyChosen.has(member.id)).map((member) => <option key={member.id} value={`family:${member.id}`}>Family profile · {member.name}</option>)}
              {selectedMember && <option value={`family:${selectedMember.id}`}>Family profile · {selectedMember.name}</option>}
            </select>
            {player.familyMemberId ? <p className="mt-2 rounded-lg border border-[#42d1b1]/15 bg-[#42d1b1]/[0.06] px-3 py-2 text-sm font-semibold text-[#42d1b1]" data-testid={`text-start-family-player-${index}`}>Family profile: {selectedMember?.name || player.name}</p> : <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#898997]">Guest name<input value={player.name} onChange={(event) => setPlayers((current) => current.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry))} maxLength={32} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-[#171821] px-3 text-sm outline-none focus:border-[#f9be4b]/50" aria-label={`Guest player ${index + 2} name`} data-testid={`input-start-player-${index + 1}`} /></label>}
          </div>;
        })}</div>
        <button type="button" disabled={players.length >= 7} onClick={() => setPlayers((current) => [...current, { name: '', familyMemberId: null }])} className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#42d1b1] disabled:opacity-40" data-testid="button-add-start-player"><Plus size={14} /> Add player ({players.length + 1}/8)</button>
        {error && <p role="alert" className="mt-3 text-sm text-[#ff9b90]" data-testid="status-start-game-error">{error}</p>}
        <button type="button" disabled={busy || players.length < 1} onClick={() => void begin()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f9be4b] py-3 text-sm font-bold text-[#171821] disabled:opacity-50" data-testid="button-confirm-start-game">{busy ? 'Starting table…' : 'Create saved game'} <ArrowRight size={15} /></button>
      </div>
    </div>}
  </>;
}