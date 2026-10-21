import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Clock3, Gamepad2, Trophy, type LucideIcon } from 'lucide-react';
import { Link } from 'wouter';
import { getProfile, requestUploadUrl, updateProfile, updateProfileAvatar } from '@workspace/api-client-react';
import type { ProfileSummary } from '@workspace/api-client-react';
import type { Game } from '../data/games';
import { FamilyProfiles } from './FamilyProfiles';
import { SessionHistory } from './SessionHistory';

type Props = { games: Game[]; favorites: string[]; onFavorite: (slug: string, favorited: boolean) => void };

export function ProfilePage({ games, favorites, onFavorite }: Props) {
  const [profile, setProfile] = useState<ProfileSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const avatarInput = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const mounted = useRef(true);
  const reload = async (silent = false) => {
    const current = ++requestRef.current;
    if (!silent) { setLoading(true); setError(''); }
    try {
      const result = await getProfile();
      if (current !== requestRef.current) return;
      setProfile(result); setUsername(result.username);
    } catch { if (current === requestRef.current) setError('Your field notes could not be loaded.'); }
    finally { if (current === requestRef.current) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; void reload(); return () => { mounted.current = false; requestRef.current += 1; }; }, []);
  const saveUsername = async () => {
    if (!profile || username.trim().length < 3) { setNameMessage('Use at least 3 characters.'); return; }
    setSavingName(true); setNameMessage('');
    try { const next = await updateProfile({ username: username.trim() }); if (!mounted.current) return; setProfile(next); setUsername(next.username); setNameMessage('Username saved.'); }
    catch { if (mounted.current) setNameMessage('That username could not be saved.'); }
    finally { if (mounted.current) setSavingName(false); }
  };
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setUploadError('Choose an image file.'); return; }
    setUploading(true); setUploadError('');
    try {
      const upload = await requestUploadUrl({ name: file.name, size: file.size, contentType: file.type });
      const response = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('Upload failed');
      const next = await updateProfileAvatar({ avatarPath: upload.objectPath });
      if (mounted.current) setProfile(next);
    } catch { if (mounted.current) setUploadError('Photo upload failed. Please try another image.'); }
    finally { if (mounted.current) setUploading(false); if (avatarInput.current) avatarInput.current.value = ''; }
  };
  const gameTitle = (slug: string, fallback?: string) => games.find((game) => game.slug === slug)?.title || fallback || slug;
  if (loading) return <section className="mx-auto max-w-[1040px] px-5 py-16" aria-label="Loading profile" data-testid="status-profile-loading"><div className="h-40 animate-pulse rounded-3xl bg-white/[0.05]" /><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" /><div className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" /><div className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" /></div></section>;
  if (error || !profile) return <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 text-center" data-testid="status-profile-error"><p className="text-sm text-[#ff9b90]">{error || 'Profile unavailable.'}</p><button onClick={() => void reload()} className="mt-4 rounded-xl bg-[#f9be4b] px-4 py-2 text-sm font-bold text-[#171821]" data-testid="button-retry-profile">Try again</button></section>;
  const sessionRow = (session: ProfileSummary['recentGames'][number], index: number) => <div className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-[#171821]/70 p-4" key={session.id} data-testid={`row-profile-game-${session.id}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#42d1b1]/10 text-[#42d1b1]"><Gamepad2 size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{gameTitle(session.gameSlug, session.gameTitle)}</p><p className="mt-1 text-xs text-[#777984]">{session.finishedAt ? new Date(session.finishedAt).toLocaleDateString() : `Game ${index + 1}`} · {session.players.length} players</p></div><span className="font-mono text-sm font-bold text-[#f9be4b]">{session.score}</span></div>;
  const metrics: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: 'Games played', value: profile.stats.gamesPlayed, Icon: Clock3 },
    { label: 'Wins', value: profile.stats.wins, Icon: Trophy },
    { label: 'High score', value: profile.stats.highScore, Icon: Check },
  ];
  return <section className="page-enter mx-auto max-w-[1040px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16" data-testid="page-profile">
     <div className="rounded-3xl border border-white/[0.09] bg-[#171821]/85 p-6 sm:p-9"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="relative h-24 w-24 shrink-0"><div className="grid h-24 w-24 place-items-center overflow-hidden rounded-3xl border border-[#f9be4b]/25 bg-[#27251f] text-3xl font-semibold text-[#f9be4b]" data-testid="avatar-profile">{profile.avatarPath ? <img src={`/api/storage${profile.avatarPath}`} alt={`${profile.username} profile`} className="h-full w-full object-cover" /> : profile.username.slice(0, 1).toUpperCase()}</div><button onClick={() => avatarInput.current?.click()} disabled={uploading} className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-xl bg-[#f9be4b] text-[#171821] disabled:opacity-50" aria-label="Change profile photo" data-testid="button-change-avatar"><Camera size={16} /></button><input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} data-testid="input-profile-avatar" /></div>
      <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#42d1b1]">Your table history</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.07em]" data-testid="text-profile-username">{profile.username}</h1><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#12131a] px-3 text-sm outline-none focus:border-[#f9be4b]/60" aria-label="App username" data-testid="input-profile-username" /><button onClick={() => void saveUsername()} disabled={savingName || username === profile.username} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-[#f7f0e4] hover:border-[#f9be4b]/50 disabled:opacity-45" data-testid="button-save-username">{savingName ? 'Saving…' : <><Check size={14} /> Save username</>}</button></div>{nameMessage && <p className="mt-2 text-xs text-[#42d1b1]" role="status" data-testid="status-username-save">{nameMessage}</p>}{uploadError && <p className="mt-2 text-xs text-[#ff9b90]" role="alert" data-testid="status-avatar-error">{uploadError}</p>}{uploading && <p className="mt-2 text-xs text-[#42d1b1]" role="status" data-testid="status-avatar-upload">Uploading profile photo…</p>}</div>
    </div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{metrics.map(({ label, value, Icon }) => <div key={label} className="rounded-2xl border border-white/[0.08] bg-[#171821]/70 p-5" data-testid={`stat-profile-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={18} className="text-[#f9be4b]" /><p className="mt-4 font-mono text-3xl font-bold" data-testid={`text-profile-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.15em] text-[#777984]">{label}</p></div>)}</div>
     <FamilyProfiles members={profile.familyMembers || []} games={games} onChanged={() => reload(true)} />
     <SessionHistory games={games} familyMembers={profile.familyMembers || []} onChanged={() => reload(true)} />
    <div className="mt-12 grid gap-10 lg:grid-cols-2"><section><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Personal records</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Best completed games</h2></div>{profile.bestGames.length ? <div className="space-y-2">{profile.bestGames.map(sessionRow)}</div> : <div className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-sm text-[#898997]" data-testid="empty-profile-best">Finish a game to start building your personal records.</div>}</section>
    <section><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Recent tables</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Past completed games</h2></div>{profile.recentGames.length ? <div className="space-y-2">{profile.recentGames.map(sessionRow)}</div> : <div className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-sm text-[#898997]" data-testid="empty-profile-history">No completed games yet. Pick a guide and start your first table.</div>}</section></div>
    <section className="mt-12 border-t border-white/[0.09] pt-9"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Saved for later</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Favorite guides</h2></div>{favorites.length ? <div className="grid gap-3 sm:grid-cols-2">{favorites.map((slug) => { const game = games.find((item) => item.slug === slug); return <div key={slug} className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#171821]/70 p-4" data-testid={`card-profile-favorite-${slug}`}><div className="min-w-0 flex-1"><p className="truncate font-semibold">{game?.title || slug}</p><p className="mt-1 text-xs text-[#898997]">In your saved field guides</p></div><button onClick={() => onFavorite(slug, false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae] hover:border-[#ff9b90]/40 hover:text-[#ff9b90]" data-testid={`button-profile-unfavorite-${slug}`}>Remove</button>{game && <Link href={`/game/${slug}`} className="text-xs font-bold text-[#f9be4b]" data-testid={`link-profile-favorite-${slug}`}>Guide</Link>}</div>; })}</div> : <div className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-sm text-[#898997]" data-testid="empty-profile-favorites">No favorites yet. Save a guide to keep it close.</div>}</section>
  </section>;
}