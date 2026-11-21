import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Gamepad2, Plus, Shield, Sparkles, Trash2, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import {
  createGameNight,
  createGameNightLocalGame,
  createGameNightProfile,
  createHistoricalGame,
  deleteGameNightLocalGame,
  inviteToGameNight,
  joinGameNight,
  saveGameNightHouseRules,
  updateGameNightMembership,
  updateGameNightProfile,
} from '@workspace/api-client-react';
import type { GameNightLocalGame, GameNightProfile, ScorekeeperMode } from '@workspace/api-client-react';
import type { Game, InventoryItem } from '../data/catalog';
import { useGameNight } from '../contexts/GameNightContext';
import { localGameToGuide } from '../lib/gameNightGame';

type PastPlayerDraft = { name: string; profileId: string; score: string; winner: boolean };

function gamePlayerCountFits(label: string, count: number) {
  const exact = label.match(/(\d+)\s+or\s+(\d+)/i);
  if (exact) return count === Number(exact[1]) || count === Number(exact[2]);
  const values = label.match(/\d+/g)?.map(Number) || [];
  if (!values.length) return true;
  const minimum = values[0];
  const maximum = values.length > 1 ? values[1] : minimum;
  return count >= minimum && count <= maximum;
}

function gameOption(game: Game, local = false) {
  return { ...game, isLocal: local };
}

export function GameNightsPage({
  gameNightId,
  games,
  inventory,
  onOpenGame,
}: {
  gameNightId?: string;
  games: Game[];
  inventory: Record<string, InventoryItem[]>;
  onOpenGame: (slug: string) => void;
}) {
  const [, setLocation] = useLocation();
  const { gameNights, invitations, selectedId, selected, loading, error, selectGameNight, refreshGameNights } = useGameNight();
  const [name, setName] = useState('');
  const [accessMode, setAccessMode] = useState<'public' | 'invitational' | 'private'>('public');
  const [joinCode, setJoinCode] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [profileName, setProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState('');
  const [editingProfileName, setEditingProfileName] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localMinPlayers, setLocalMinPlayers] = useState(2);
  const [localMaxPlayers, setLocalMaxPlayers] = useState(8);
  const [localRules, setLocalRules] = useState('');
  const [localVariations, setLocalVariations] = useState('');
  const [localModeName, setLocalModeName] = useState('Points game');
  const [localModeStrategy, setLocalModeStrategy] = useState<'points' | 'winner' | 'first_to'>('points');
  const [localModeDirection, setLocalModeDirection] = useState<'highest' | 'lowest'>('highest');
  const [localTargetScore, setLocalTargetScore] = useState(10);
  const [ruleGameSlug, setRuleGameSlug] = useState('');
  const [houseRulesText, setHouseRulesText] = useState('');
  const [houseVariation, setHouseVariation] = useState('');
  const [rulesVersion, setRulesVersion] = useState('1.0');
  const [playingProfileIds, setPlayingProfileIds] = useState<string[]>([]);
  const [pickedGame, setPickedGame] = useState('');
  const [showPastGameForm, setShowPastGameForm] = useState(false);
  const [pastGameSlug, setPastGameSlug] = useState('');
  const [pastModeId, setPastModeId] = useState('');
  const [pastVariation, setPastVariation] = useState('');
  const [pastDate, setPastDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pastNote, setPastNote] = useState('');
  const [pastPlayers, setPastPlayers] = useState<PastPlayerDraft[]>([
    { name: '', profileId: '', score: '0', winner: false },
    { name: '', profileId: '', score: '0', winner: false },
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (gameNightId && selectedId !== gameNightId) void selectGameNight(gameNightId);
  }, [gameNightId, selectedId, selectGameNight]);

  const current = selected && (!gameNightId || selected.night.id === gameNightId) ? selected : undefined;
  const isHost = current?.night.role === 'host';
  const activeProfiles = current?.profiles.filter((profile) => profile.isActive) || [];
  const localGames = current?.localGames || [];
  const allGameOptions = useMemo(() => [
    ...games.map((game) => gameOption(game)),
    ...localGames.map((local) => gameOption(localGameToGuide(local), true)),
  ], [games, localGames]);
  const pastGame = allGameOptions.find((game) => game.slug === pastGameSlug);
  const pastMode = pastGame?.scorekeeperModes?.find((mode) => mode.id === pastModeId) || pastGame?.scorekeeperModes?.[0];
  const houseRuleGames = allGameOptions;

  useEffect(() => {
    if (!ruleGameSlug && houseRuleGames.length) setRuleGameSlug(houseRuleGames[0].slug);
  }, [houseRuleGames, ruleGameSlug]);

  useEffect(() => {
    const saved = current?.houseRules.find((rule) => rule.gameSlug === ruleGameSlug);
    setHouseRulesText(saved?.rulesText || '');
    setHouseVariation(saved?.variation || '');
    setRulesVersion(saved?.rulesVersion || '1.0');
  }, [current, ruleGameSlug]);

  useEffect(() => {
    if (pastGame && !pastGame.scorekeeperModes?.some((mode) => mode.id === pastModeId)) {
      setPastModeId(pastGame.scorekeeperModes?.[0]?.id || 'points');
      setPastVariation('');
    }
  }, [pastGame, pastModeId]);

  useEffect(() => {
    if (!playingProfileIds.length && activeProfiles.length) {
      setPlayingProfileIds(activeProfiles.slice(0, Math.min(2, activeProfiles.length)).map((profile) => profile.id));
    }
  }, [activeProfiles, playingProfileIds.length]);

  const runAction = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setLocalError('');
    setMessage('');
    try {
      await action();
      if (success) setMessage(success);
    } catch {
      setLocalError('That change could not be saved. Check the details and try again.');
    } finally {
      setBusy(false);
    }
  };

  const createNight = () => runAction(async () => {
    if (!name.trim()) throw new Error('A name is required.');
    const created = await createGameNight({ name: name.trim(), accessMode });
    setName('');
    await refreshGameNights(created.id);
    setLocation(`/game-nights/${created.id}`);
  });

  const joinNight = () => runAction(async () => {
    const result = await joinGameNight({ code: joinCode.trim().toUpperCase() });
    setJoinCode('');
    if (result.status === 'joined' || result.status === 'already_member') {
      await refreshGameNights(result.gameNight.id);
      setLocation(`/game-nights/${result.gameNight.id}`);
    } else {
      await refreshGameNights();
      setMessage('Request sent. The host must approve it before you can open the Game Night.');
    }
  });

  const respondToInvite = (gameNightId: string, membershipId: string, action: 'accept' | 'deny') => runAction(async () => {
    await updateGameNightMembership(gameNightId, membershipId, { action });
    await refreshGameNights(gameNightId);
  }, action === 'accept' ? 'Invitation accepted.' : 'Invitation declined.');

  const inviteMember = () => current && runAction(async () => {
    await inviteToGameNight(current.night.id, { username: inviteUsername.trim() });
    setInviteUsername('');
    await refreshGameNights(current.night.id);
  }, 'Invitation sent.');

  const addProfile = () => current && runAction(async () => {
    await createGameNightProfile(current.night.id, { name: profileName.trim() });
    setProfileName('');
    await refreshGameNights(current.night.id);
  }, 'Family profile added.');

  const saveProfile = (profile: GameNightProfile, patch: { name?: string; isActive?: boolean }) => current && runAction(async () => {
    await updateGameNightProfile(current.night.id, profile.id, patch);
    setEditingProfileId('');
    await refreshGameNights(current.night.id);
  }, patch.isActive === false ? 'Profile archived; its game history stays available.' : 'Family profile updated.');

  const respondToRequest = (membershipId: string, action: 'accept' | 'deny' | 'remove') => current && runAction(async () => {
    await updateGameNightMembership(current.night.id, membershipId, { action });
    await refreshGameNights(current.night.id);
  }, action === 'accept' ? 'Player accepted.' : action === 'deny' ? 'Request declined.' : 'Member removed.');

  const addLocalGame = () => current && runAction(async () => {
    if (!localTitle.trim() || localMinPlayers > localMaxPlayers) throw new Error('Enter a title and valid player range.');
    const id = localModeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'points';
    const mode: ScorekeeperMode = localModeStrategy === 'points'
      ? { id, name: localModeName.trim(), strategy: 'points', direction: localModeDirection }
      : localModeStrategy === 'first_to'
        ? { id, name: localModeName.trim(), strategy: 'first_to', targetScore: localTargetScore }
        : { id, name: localModeName.trim(), strategy: 'winner' };
    await createGameNightLocalGame(current.night.id, {
      title: localTitle.trim(),
      description: localDescription.trim(),
      minPlayers: localMinPlayers,
      maxPlayers: localMaxPlayers,
      rules: localRules.trim(),
      scorekeeperModes: [mode],
      variations: localVariations.split(',').map((value) => value.trim()).filter(Boolean),
    });
    setLocalTitle(''); setLocalDescription(''); setLocalRules(''); setLocalVariations('');
    await refreshGameNights(current.night.id);
  }, 'Local game added to this Game Night.');

  const removeLocalGame = (game: GameNightLocalGame) => current && window.confirm(`Remove ${game.title} from this Game Night? Past results will remain in the timeline.`) && runAction(async () => {
    await deleteGameNightLocalGame(current.night.id, game.id);
    await refreshGameNights(current.night.id);
  }, 'Local game removed.');

  const saveHouseRules = () => current && ruleGameSlug && runAction(async () => {
    await saveGameNightHouseRules(current.night.id, ruleGameSlug, {
      rulesText: houseRulesText.trim() || null,
      variation: houseVariation.trim() || null,
      rulesVersion: rulesVersion.trim() || null,
    });
    await refreshGameNights(current.night.id);
  }, 'House rules and rules version saved.');

  const eligibleGames = useMemo(() => {
    if (!current || !playingProfileIds.length) return [];
    const count = playingProfileIds.length;
    const global = games.filter((game) => (inventory[game.slug] || []).length > 0 && gamePlayerCountFits(game.players, count));
    const local = localGames.filter((game) => count >= game.minPlayers && count <= game.maxPlayers).map(localGameToGuide);
    return [...global, ...local];
  }, [current, games, inventory, localGames, playingProfileIds]);

  const pickGame = () => {
    if (!eligibleGames.length) {
      setPickedGame('');
      return;
    }
    const game = eligibleGames[Math.floor(Math.random() * eligibleGames.length)];
    setPickedGame(game.title);
    setMessage('');
  };

  const openPastGameForm = () => {
    setPastGameSlug(allGameOptions[0]?.slug || '');
    setPastModeId(allGameOptions[0]?.scorekeeperModes?.[0]?.id || 'points');
    setPastVariation('');
    setPastDate(new Date().toISOString().slice(0, 10));
    setPastNote('');
    setPastPlayers([
      { name: '', profileId: '', score: '0', winner: false },
      { name: '', profileId: '', score: '0', winner: false },
    ]);
    setShowPastGameForm(true);
  };

  const savePastGame = () => current && pastGame && pastMode && runAction(async () => {
    if (pastPlayers.some((player) => !player.profileId && !player.name.trim())) throw new Error('Name every player or choose a family profile.');
    const numbers = pastPlayers.map((player) => Number(player.score || 0));
    if (pastMode.strategy !== 'winner' && numbers.some((value) => !Number.isSafeInteger(value))) throw new Error('Scores must be whole numbers.');
    const winnerIndex = pastPlayers.findIndex((player) => player.winner);
    if ((pastMode.strategy === 'winner' || pastMode.strategy === 'first_to') && pastPlayers.filter((player) => player.winner).length !== 1) throw new Error('Select exactly one winner.');
    if (pastMode.strategy === 'first_to' && numbers[winnerIndex] < (pastMode.targetScore || 10)) throw new Error(`The winner must have reached ${pastMode.targetScore || 10} points.`);
    const bestScore = pastMode.strategy === 'points'
      ? (pastMode.direction === 'lowest' ? Math.min(...numbers) : Math.max(...numbers))
      : undefined;
    await createHistoricalGame({
      gameNightId: current.night.id,
      gameSlug: pastGame.slug,
      modeId: pastMode.id,
      playedAt: new Date(`${pastDate}T12:00:00`).toISOString(),
      variation: pastVariation || null,
      note: pastNote.trim() || null,
      players: pastPlayers.map((player, index) => ({
        name: player.profileId ? activeProfiles.find((profile) => profile.id === player.profileId)?.name || player.name : player.name.trim(),
        score: pastMode.strategy === 'winner' ? null : numbers[index],
        isYou: false,
        familyMemberId: null,
        gameNightProfileId: player.profileId || null,
        isWinner: pastMode.strategy === 'points' ? numbers[index] === bestScore : player.winner,
      })),
    });
    setShowPastGameForm(false);
    await refreshGameNights(current.night.id);
  }, 'Previous game added to the timeline.');

  if (!gameNightId) {
    return <section className="page-enter mx-auto max-w-[1040px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16" data-testid="page-game-nights">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#42d1b1]">The people at your table</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.07em] sm:text-5xl">Family Game Nights</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#898997]">Create a shared group, add family profiles, and keep every table’s history together.</p></div><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#a2a2ae] hover:text-[#f9be4b]"><ArrowLeft size={15} /> Back to games</Link></div>
      {(error || localError) && <p role="alert" className="mt-5 rounded-xl border border-[#ff9b90]/20 bg-[#ff9b90]/[0.06] px-4 py-3 text-sm text-[#ff9b90]">{localError || error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-[#42d1b1]">{message}</p>}
      {invitations.length > 0 && <section className="mt-8 rounded-2xl border border-[#f9be4b]/20 bg-[#302718]/30 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f9be4b]">Invitations</p><div className="mt-3 space-y-2">{invitations.map((invitation) => <div key={invitation.membershipId} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#171821]/75 p-3"><div className="min-w-0 flex-1"><p className="font-semibold">{invitation.gameNightName}</p><p className="mt-1 text-xs text-[#898997]">Invited by {invitation.hostUsername}</p></div><button type="button" disabled={busy} onClick={() => void respondToInvite(invitation.gameNightId, invitation.membershipId, 'accept')} className="rounded-lg bg-[#f9be4b] px-3 py-2 text-xs font-bold text-[#171821]">Accept</button><button type="button" disabled={busy} onClick={() => void respondToInvite(invitation.gameNightId, invitation.membershipId, 'deny')} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae]">Decline</button></div>)}</div></section>}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.09] bg-[#171821]/75 p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#42d1b1]">Start a group</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Create a Game Night</h2><label className="mt-5 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Group name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={48} placeholder="The Friday table" className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 text-sm normal-case tracking-normal text-[#f7f0e4] outline-none focus:border-[#f9be4b]/50" /></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Who can join?<select value={accessMode} onChange={(event) => setAccessMode(event.target.value as typeof accessMode)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 text-sm normal-case tracking-normal text-[#f7f0e4] outline-none focus:border-[#f9be4b]/50"><option value="public">Public · code joins immediately</option><option value="invitational">Invitational · host approves code requests</option><option value="private">Private · host invites by username</option></select></label><button type="button" disabled={busy || !name.trim()} onClick={() => void createNight()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#f9be4b] px-4 py-3 text-sm font-bold text-[#171821] disabled:opacity-50"><Plus size={15} /> Create Game Night</button></section>
        <section className="rounded-2xl border border-white/[0.09] bg-[#171821]/75 p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f9be4b]">Join a group</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Enter a four-letter code</h2><p className="mt-2 text-sm leading-6 text-[#898997]">Public nights open immediately. Invitational nights send a request to the host.</p><label className="mt-5 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Game Night code<input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} maxLength={4} placeholder="ABCD" className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 font-mono text-xl uppercase tracking-[0.3em] text-[#f7f0e4] outline-none focus:border-[#f9be4b]/50" /></label><button type="button" disabled={busy || joinCode.length !== 4} onClick={() => void joinNight()} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#42d1b1]/30 px-4 py-3 text-sm font-bold text-[#42d1b1] disabled:opacity-50">Continue with code <ArrowRight size={15} /></button></section>
      </div>
      <section className="mt-10 border-t border-white/[0.09] pt-8"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Your groups</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Game Nights you can open</h2></div><button type="button" onClick={() => void refreshGameNights()} className="text-xs font-semibold text-[#f9be4b]">Refresh</button></div>{loading ? <p className="mt-5 text-sm text-[#898997]">Loading Game Nights…</p> : gameNights.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{gameNights.map((night) => <article key={night.id} className={`rounded-2xl border p-5 ${selectedId === night.id ? 'border-[#42d1b1]/35 bg-[#12201e]/55' : 'border-white/[0.08] bg-[#171821]/75'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-[#42d1b1]">{night.role} · {night.accessMode}</p><h3 className="mt-2 text-xl font-semibold">{night.name}</h3><p className="mt-1 text-xs text-[#898997]">{night.memberCount} members</p></div><Users className="text-[#42d1b1]" size={18} /></div><div className="mt-4 flex items-center justify-between gap-3">{night.joinCode && <span className="font-mono text-sm font-bold tracking-[0.25em] text-[#f9be4b]">{night.joinCode}</span>}<div className="ml-auto flex gap-2"><button type="button" onClick={() => void selectGameNight(night.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae]">Use this group</button><Link href={`/game-nights/${night.id}`} className="rounded-lg bg-[#f9be4b] px-3 py-2 text-xs font-bold text-[#171821]">Open</Link></div></div></article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/15 px-5 py-8 text-sm text-[#898997]">No Game Nights yet. Create one or join with a code.</div>}</section>
    </section>;
  }

  if (loading && !current) return <section className="mx-auto max-w-[1040px] px-5 py-16 text-sm text-[#898997]" data-testid="status-game-night-loading">Opening Game Night…</section>;
  if (!current) return <section className="mx-auto max-w-[760px] px-5 py-20 text-center"><p className="text-sm text-[#ff9b90]">{localError || error || 'This Game Night is not available to your account.'}</p><Link href="/game-nights" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#f9be4b]"><ArrowLeft size={15} /> Back to Game Nights</Link></section>;

  return <section className="page-enter mx-auto max-w-[1080px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14" data-testid="page-game-night-detail">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><Link href="/game-nights" className="inline-flex items-center gap-2 text-sm font-semibold text-[#a2a2ae] hover:text-[#f9be4b]"><ArrowLeft size={15} /> All Game Nights</Link><button type="button" onClick={() => void navigator.clipboard?.writeText(current.night.joinCode || '')} disabled={!current.night.joinCode} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae] disabled:opacity-40"><Copy size={13} /> {current.night.joinCode ? `Code ${current.night.joinCode}` : 'Private group'}</button></div>
    <div className="rounded-3xl border border-white/[0.09] bg-[#171821]/85 p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#42d1b1]">{current.night.accessMode} Game Night · {current.night.memberCount} members</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.07em] sm:text-5xl">{current.night.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#898997]">Family profiles, house rules, and game history for this group. {isHost ? 'You are the host.' : 'The host manages membership and rules.'}</p></div>{gameNights.length > 1 && <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Active table<select value={current.night.id} onChange={(event) => void selectGameNight(event.target.value)} className="mt-2 block h-10 rounded-lg border border-white/10 bg-[#12131a] px-3 text-sm normal-case tracking-normal text-[#f7f0e4]">{gameNights.map((night) => <option key={night.id} value={night.id}>{night.name}</option>)}</select></label>}</div></div>
    {(error || localError) && <p role="alert" className="mt-4 rounded-xl border border-[#ff9b90]/20 bg-[#ff9b90]/[0.06] px-4 py-3 text-sm text-[#ff9b90]">{localError || error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-[#42d1b1]">{message}</p>}

    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/[0.08] bg-[#171821]/70 p-5"><div className="flex items-center gap-2"><Users size={17} className="text-[#42d1b1]" /><h2 className="text-xl font-semibold">Family profiles</h2></div><p className="mt-2 text-xs leading-5 text-[#898997]">These players appear on this Game Night’s scorekeeper and leaderboard.</p>{isHost && <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void addProfile(); }}><input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={32} placeholder="Add a family profile" className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#12131a] px-3 text-sm outline-none focus:border-[#f9be4b]/50" /><button type="submit" disabled={busy || !profileName.trim()} className="grid h-10 w-10 place-items-center rounded-lg bg-[#f9be4b] text-[#171821] disabled:opacity-50"><Plus size={15} /></button></form>}<div className="mt-4 space-y-2">{current.profiles.map((profile) => <div key={profile.id} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#12131a] p-3"><span className={`grid h-8 w-8 place-items-center rounded-lg font-semibold ${profile.isActive ? 'bg-[#42d1b1]/10 text-[#42d1b1]' : 'bg-white/[0.06] text-[#898997]'}`}>{profile.name.slice(0, 1).toUpperCase()}</span>{editingProfileId === profile.id ? <input autoFocus value={editingProfileName} onChange={(event) => setEditingProfileName(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#171821] px-2 text-sm" /> : <span className="min-w-0 flex-1 truncate text-sm font-semibold">{profile.name}</span>}<span className="text-[10px] uppercase text-[#777984]">{profile.isActive ? 'Active' : 'Archived'}</span>{isHost && (editingProfileId === profile.id ? <><button type="button" disabled={busy} onClick={() => void saveProfile(profile, { name: editingProfileName })} className="rounded-lg bg-[#f9be4b] p-2 text-[#171821]"><Check size={13} /></button><button type="button" onClick={() => setEditingProfileId('')} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-[#a2a2ae]">Cancel</button></> : <><button type="button" onClick={() => { setEditingProfileId(profile.id); setEditingProfileName(profile.name); }} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-[#a2a2ae]">Rename</button><button type="button" disabled={busy} onClick={() => void saveProfile(profile, { isActive: !profile.isActive })} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-[#a2a2ae]">{profile.isActive ? 'Archive' : 'Restore'}</button></>)}</div>)}{!current.profiles.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-[#898997]">No profiles yet.</p>}</div></section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#171821]/70 p-5"><div className="flex items-center gap-2"><Shield size={17} className="text-[#f9be4b]" /><h2 className="text-xl font-semibold">Members</h2></div><div className="mt-4 space-y-2">{current.members.map((member) => <div key={member.id} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#12131a] p-3"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{member.username}</span><span className="text-[10px] uppercase text-[#777984]">{member.role} · {member.status}</span>{isHost && member.status === 'pending' && <><button type="button" disabled={busy} onClick={() => void respondToRequest(member.id, 'accept')} className="rounded-lg bg-[#f9be4b] px-2 py-1.5 text-xs font-bold text-[#171821]">Accept</button><button type="button" disabled={busy} onClick={() => void respondToRequest(member.id, 'deny')} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-[#a2a2ae]">Deny</button></>}{isHost && member.role !== 'host' && member.status === 'active' && <button type="button" disabled={busy} onClick={() => void respondToRequest(member.id, 'remove')} className="rounded-lg border border-white/10 p-2 text-[#898997] hover:text-[#ff9b90]" aria-label={`Remove ${member.username}`}><Trash2 size={13} /></button>}</div>)}</div>{isHost && current.night.accessMode === 'private' && <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void inviteMember(); }}><input value={inviteUsername} onChange={(event) => setInviteUsername(event.target.value)} maxLength={20} placeholder="Account username" className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#12131a] px-3 text-sm outline-none focus:border-[#f9be4b]/50" /><button type="submit" disabled={busy || !inviteUsername.trim()} className="rounded-lg border border-[#42d1b1]/30 px-3 text-xs font-bold text-[#42d1b1] disabled:opacity-50">Invite</button></form>}{isHost && current.night.accessMode !== 'private' && <p className="mt-4 text-xs text-[#898997]">Share the four-letter code. {current.night.accessMode === 'invitational' ? 'Requests appear here for your approval.' : 'Public access is immediate.'}</p>}</section>
    </div>

    <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#171821]/70 p-5"><div className="flex items-center gap-2"><Sparkles size={17} className="text-[#f9be4b]" /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f9be4b]">What should we play?</p><h2 className="mt-1 text-xl font-semibold">Pick from the inventory</h2></div></div><p className="mt-2 text-xs leading-5 text-[#898997]">The picker checks player count and only includes catalog games in the Inventory Bank plus your local games.</p><div className="mt-4 flex flex-wrap gap-2">{activeProfiles.map((profile) => <label key={profile.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${playingProfileIds.includes(profile.id) ? 'border-[#42d1b1]/40 bg-[#42d1b1]/[0.08] text-[#42d1b1]' : 'border-white/10 text-[#a2a2ae]'}`}><input type="checkbox" checked={playingProfileIds.includes(profile.id)} onChange={(event) => setPlayingProfileIds((ids) => event.target.checked ? [...ids, profile.id] : ids.filter((id) => id !== profile.id))} className="accent-[#42d1b1]" />{profile.name}</label>)}</div>{!activeProfiles.length && <p className="mt-3 text-xs text-[#898997]">Add active family profiles to filter by who is playing.</p>}<div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={!eligibleGames.length} onClick={pickGame} className="inline-flex items-center gap-2 rounded-xl bg-[#f9be4b] px-4 py-3 text-sm font-bold text-[#171821] disabled:opacity-45"><Sparkles size={15} /> Pick a game</button><span className="text-xs text-[#898997]">{eligibleGames.length} games fit {playingProfileIds.length} selected profile{playingProfileIds.length === 1 ? '' : 's'}.</span>{pickedGame && <p className="w-full rounded-xl border border-[#f9be4b]/20 bg-[#302718]/30 p-3 text-sm text-[#f9be4b]">Try <strong>{pickedGame}</strong> tonight.</p>}</div></section>

    {isHost && <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#171821]/70 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#42d1b1]">Only for this group</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Local games</h2><p className="mt-2 text-sm text-[#898997]">These games are visible only to members of this Game Night.</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><input value={localTitle} onChange={(event) => setLocalTitle(event.target.value)} placeholder="Game title" className="admin-input" /><input value={localDescription} onChange={(event) => setLocalDescription(event.target.value)} placeholder="Short description" className="admin-input" /><input type="number" min={1} max={100} value={localMinPlayers} onChange={(event) => setLocalMinPlayers(Number(event.target.value))} aria-label="Minimum players" className="admin-input" /><input type="number" min={1} max={100} value={localMaxPlayers} onChange={(event) => setLocalMaxPlayers(Number(event.target.value))} aria-label="Maximum players" className="admin-input" /><input value={localModeName} onChange={(event) => setLocalModeName(event.target.value)} placeholder="Scorekeeper mode name" className="admin-input" /><select value={localModeStrategy} onChange={(event) => setLocalModeStrategy(event.target.value as typeof localModeStrategy)} className="admin-input"><option value="points">Points</option><option value="winner">Who won?</option><option value="first_to">First to target</option></select>{localModeStrategy === 'points' && <select value={localModeDirection} onChange={(event) => setLocalModeDirection(event.target.value as typeof localModeDirection)} className="admin-input"><option value="highest">Highest wins</option><option value="lowest">Lowest wins</option></select>}{localModeStrategy === 'first_to' && <input type="number" min={1} max={1000000} value={localTargetScore} onChange={(event) => setLocalTargetScore(Number(event.target.value))} aria-label="Target score" className="admin-input" />}<input value={localVariations} onChange={(event) => setLocalVariations(event.target.value)} placeholder="Variations, separated by commas" className="admin-input sm:col-span-2" /><textarea value={localRules} onChange={(event) => setLocalRules(event.target.value)} placeholder="Rules, one step per line" className="admin-input min-h-24 resize-y sm:col-span-2" /></div><button type="button" disabled={busy || !localTitle.trim()} onClick={() => void addLocalGame()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#f9be4b] px-4 py-3 text-sm font-bold text-[#171821] disabled:opacity-50"><Plus size={15} /> Add local game</button><div className="mt-4 grid gap-2 sm:grid-cols-2">{localGames.map((game) => <div key={game.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#12131a] p-3"><Gamepad2 className="shrink-0 text-[#42d1b1]" size={17} /><button type="button" onClick={() => onOpenGame(game.slug)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{game.title}</span><span className="text-xs text-[#898997]">{game.minPlayers}–{game.maxPlayers} players</span></button><button type="button" onClick={() => removeLocalGame(game)} className="rounded-lg p-2 text-[#898997] hover:text-[#ff9b90]" aria-label={`Remove ${game.title}`}><Trash2 size={14} /></button></div>)}</div></section>}

    {isHost && <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#171821]/70 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#42d1b1]">House rules</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Set rules and article version</h2><p className="mt-2 text-sm text-[#898997]">A badge appears on the game guide when this group has a house rule or variation.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Game<select value={ruleGameSlug} onChange={(event) => setRuleGameSlug(event.target.value)} className="admin-input mt-2">{houseRuleGames.map((game) => <option key={game.slug} value={game.slug}>{game.title}</option>)}</select></label><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Rules version<input value={rulesVersion} onChange={(event) => setRulesVersion(event.target.value)} maxLength={24} placeholder="1.0" className="admin-input mt-2" /></label><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997] sm:col-span-2">House variation<input value={houseVariation} onChange={(event) => setHouseVariation(event.target.value)} maxLength={120} placeholder="Local, normal, beginner…" className="admin-input mt-2" /></label><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997] sm:col-span-2">House rules<textarea value={houseRulesText} onChange={(event) => setHouseRulesText(event.target.value)} maxLength={6000} placeholder="Add rules for this group…" className="admin-input mt-2 min-h-24 resize-y" /></label></div><button type="button" disabled={busy || !ruleGameSlug} onClick={() => void saveHouseRules()} className="mt-3 rounded-xl border border-[#42d1b1]/30 px-4 py-3 text-sm font-bold text-[#42d1b1] disabled:opacity-50">Save house rules</button></section>}

    <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#171821]/70 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e9a4cc]">The family ledger</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Game timeline</h2><p className="mt-1 text-xs text-[#898997]">Live sessions and manually added past games.</p></div><button type="button" onClick={openPastGameForm} className="inline-flex items-center gap-2 rounded-xl bg-[#f9be4b] px-3 py-2.5 text-xs font-bold text-[#171821]"><Plus size={14} /> Add previous game</button></div>
      {showPastGameForm && <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#12131a] p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Game<select value={pastGameSlug} onChange={(event) => { setPastGameSlug(event.target.value); setPastVariation(''); }} className="admin-input mt-2">{allGameOptions.map((game) => <option key={game.slug} value={game.slug}>{game.title}</option>)}</select></label><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Scorekeeper mode<select value={pastModeId} onChange={(event) => setPastModeId(event.target.value)} className="admin-input mt-2">{pastGame?.scorekeeperModes?.map((mode) => <option key={mode.id} value={mode.id}>{mode.name}</option>)}</select></label><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Date played<input type="date" value={pastDate} onChange={(event) => setPastDate(event.target.value)} className="admin-input mt-2" /></label>{pastGame?.variations?.length ? <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Variation<select value={pastVariation} onChange={(event) => setPastVariation(event.target.value)} className="admin-input mt-2"><option value="">Standard rules</option>{pastGame.variations.map((variation) => <option key={variation}>{variation}</option>)}</select></label> : null}</div><div className="mt-4 space-y-2">{pastPlayers.map((player, index) => <div key={index} className="grid gap-2 rounded-xl border border-white/[0.07] bg-[#171821] p-3 sm:grid-cols-[1.2fr_1fr_.7fr_auto]"><label className="text-[9px] font-bold uppercase text-[#777984]">Family profile<select value={player.profileId} onChange={(event) => { const profile = activeProfiles.find((item) => item.id === event.target.value); setPastPlayers((items) => items.map((item, i) => i === index ? { ...item, profileId: event.target.value, name: profile?.name || '' } : item)); }} className="admin-input mt-1.5"><option value="">Guest / custom name</option>{activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="text-[9px] font-bold uppercase text-[#777984]">Player name<input disabled={Boolean(player.profileId)} value={player.name} onChange={(event) => setPastPlayers((items) => items.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} className="admin-input mt-1.5" /></label>{pastMode?.strategy !== 'winner' && <label className="text-[9px] font-bold uppercase text-[#777984]">Score<input type="number" value={player.score} onChange={(event) => setPastPlayers((items) => items.map((item, i) => i === index ? { ...item, score: event.target.value } : item))} className="admin-input mt-1.5" /></label>}<div className="flex items-end gap-2">{pastMode?.strategy !== 'points' && <label className="mb-2 flex items-center gap-1.5 text-xs text-[#f9be4b]"><input type="radio" checked={player.winner} onChange={() => setPastPlayers((items) => items.map((item, i) => ({ ...item, winner: i === index })))} /> Winner</label>}{pastPlayers.length > 2 && <button type="button" onClick={() => setPastPlayers((items) => items.filter((_, i) => i !== index))} className="mb-1 rounded-lg p-2 text-[#898997] hover:text-[#ff9b90]" aria-label={`Remove player ${index + 1}`}><Trash2 size={14} /></button>}</div></div>)}<button type="button" disabled={pastPlayers.length >= 8} onClick={() => setPastPlayers((items) => [...items, { name: '', profileId: '', score: '0', winner: false }])} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#42d1b1] disabled:opacity-50"><Plus size={13} /> Add player</button></div><label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Game note<textarea value={pastNote} onChange={(event) => setPastNote(event.target.value)} maxLength={1000} placeholder="A good night, a close finish, or anything to remember…" className="admin-input mt-2 min-h-16 resize-y" /></label><div className="mt-4 flex gap-2"><button type="button" disabled={busy} onClick={() => void savePastGame()} className="rounded-xl bg-[#f9be4b] px-4 py-2.5 text-xs font-bold text-[#171821] disabled:opacity-50">Save game</button><button type="button" onClick={() => setShowPastGameForm(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-[#a2a2ae]">Cancel</button></div></div>}
      {current.timeline.length ? <ol className="mt-5 space-y-2">{current.timeline.map((session) => <li key={session.id} className="rounded-xl border border-white/[0.08] bg-[#12131a] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><Gamepad2 size={15} className="text-[#42d1b1]" /><p className="truncate text-sm font-semibold">{session.gameTitle || session.gameSlug}</p></div><p className="mt-1 text-xs text-[#777984]">{new Date(session.playedAt || session.startedAt).toLocaleDateString()} · {session.modeName}{session.variation ? ` · ${session.variation}` : ''}</p></div><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#898997]">{session.source === 'historical' ? 'Past game' : 'Live game'}</span></div><div className="mt-3 flex flex-wrap gap-2">{session.players.map((player, index) => <span key={`${player.name}-${index}`} className={`rounded-lg px-2.5 py-1.5 text-xs ${player.isWinner ? 'bg-[#f9be4b]/10 text-[#f9be4b]' : 'bg-white/[0.05] text-[#c2c0c0]'}`}>{player.name}{session.strategy !== 'winner' ? ` · ${player.score}` : ''}{player.isWinner ? ' · Winner' : ''}</span>)}</div>{session.note && <p className="mt-3 border-t border-white/[0.07] pt-3 text-xs leading-5 text-[#a2a2ae]">“{session.note}”</p>}</li>)}</ol> : <div className="mt-5 rounded-xl border border-dashed border-white/15 px-5 py-8 text-center text-sm text-[#898997]">No games in the timeline yet.</div>}
    </section>
  </section>;
}
