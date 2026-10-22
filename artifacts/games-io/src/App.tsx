import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { getCatalogAdminStatus, getProfile, requestUploadUrl, setGameFavorite, unlockCatalogAdmin } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, ChevronRight, CircleHelp, Clock3, Copy, Filter, Gamepad2, Heart, LockKeyhole, LogIn, LogOut, Minus, Plus, Printer, RotateCcw, Search, Sparkles, Users, X } from 'lucide-react';
import { Link, Router as WouterRouter, Route, Switch, useLocation } from 'wouter';
import { AdminPanel } from './components/AdminPanel';
import { InventoryBank } from './components/InventoryBank';
import { ArticleMarkdown } from './components/ArticleMarkdown';
import { FavoriteButton } from './components/FavoriteButton';
import { GamePlayPage } from './components/GamePlayPage';
import { ProfilePage } from './components/ProfilePage';
import { StartGameButton } from './components/StartGameButton';
import { useCatalog } from './hooks/use-catalog';
import type { Game, GameCategory } from './data/games';

const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#f9be4b',
    colorForeground: '#f7f0e4',
    colorMutedForeground: '#9a9aa5',
    colorDanger: '#ff9b90',
    colorBackground: '#171821',
    colorInput: '#12131a',
    colorInputForeground: '#f7f0e4',
    colorNeutral: '#3a3942',
    fontFamily: 'Avenir Next, Trebuchet MS, sans-serif',
    borderRadius: '0.9rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#171821] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#f7f0e4]',
    headerSubtitle: 'text-[#a2a2ae]',
    socialButtonsBlockButtonText: 'text-[#f7f0e4]',
    formFieldLabel: 'text-[#c2c0c0]',
    footerActionLink: 'text-[#f9be4b]',
    footerActionText: 'text-[#a2a2ae]',
    dividerText: 'text-[#898997]',
    identityPreviewEditButton: 'text-[#f9be4b]',
    formFieldSuccessText: 'text-[#42d1b1]',
    alertText: 'text-[#ffb5ac]',
    logoBox: 'h-10',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-white/10 bg-[#12131a] hover:bg-[#24232a]',
    formButtonPrimary: 'bg-[#f9be4b] text-[#171821] hover:bg-[#ffd47e]',
    formFieldInput: 'border-white/10 bg-[#12131a] text-[#f7f0e4]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-white/10',
    alert: 'border-[#ff9b90]/30 bg-[#ff9b90]/10',
    otpCodeFieldInput: 'border-white/10 bg-[#12131a] text-[#f7f0e4]',
    formFieldRow: 'text-[#f7f0e4]',
    main: 'bg-transparent',
  },
};

function Logo({ onClick }: { onClick?: () => void }) {
  return <button onClick={onClick} className="group flex items-center gap-3 text-left" data-testid="button-brand-home"><span className="relative grid h-9 w-9 place-items-center rounded-xl bg-[#f9be4b] text-[#171821] shadow-[0_7px_0_#bb842b] transition-transform group-hover:-translate-y-0.5 group-active:translate-y-0.5 group-active:shadow-[0_3px_0_#bb842b]"><Gamepad2 size={20} strokeWidth={2.6} /></span><span className="font-mono text-lg font-bold tracking-[-0.08em] text-[#f7f0e4]">games<span className="text-[#f9be4b]">.io</span></span></button>;
}

function AuthControls({ onAdmin, adminUnlocked }: { onAdmin: () => void; adminUnlocked: boolean }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  if (!isLoaded) return <span className="h-8 w-20 animate-pulse rounded-lg bg-white/[0.06]" aria-label="Loading account" />;
  if (!user) return <div className="flex items-center gap-2"><Link href="/sign-in" className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-[#a2a2ae] hover:text-[#f7f0e4] sm:inline" data-testid="link-sign-in"><LogIn size={14} className="mr-1 inline" /> Sign in</Link><Link href="/sign-up" className="rounded-lg bg-[#f9be4b] px-3 py-2 text-xs font-bold text-[#171821] hover:bg-[#ffd47e]" data-testid="link-sign-up">Join the table</Link></div>;
  const email = user.primaryEmailAddress?.emailAddress || user.username || 'Signed in';
  return <div className="flex items-center gap-2"><Link href="/profile" className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-[#a2a2ae] hover:text-[#42d1b1]" data-testid="link-profile"><span className="hidden sm:inline">Profile</span><Heart size={14} className="sm:hidden" /></Link><button type="button" onClick={onAdmin} className="flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-2 text-xs font-semibold text-[#a2a2ae] hover:border-[#f9be4b]/50 hover:text-[#f9be4b] sm:px-3" data-testid="button-open-admin"><LockKeyhole size={13} /><span className="hidden sm:inline">Admin</span>{adminUnlocked && <span className="rounded-full bg-[#42d1b1]/15 px-1.5 py-0.5 font-mono text-[9px] text-[#42d1b1]">ADMIN</span>}</button><span className="hidden max-w-[150px] truncate text-xs text-[#898997] md:inline" title={email} data-testid="text-account-indicator">{email}</span><button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="grid h-8 w-8 place-items-center rounded-lg text-[#898997] hover:bg-white/[0.07] hover:text-[#f7f0e4]" aria-label="Log out" data-testid="button-log-out"><LogOut size={15} /></button></div>;
}

function Shell({ children, onHome, onAdmin, adminUnlocked, hideChrome = false }: { children: ReactNode; onHome: () => void; onAdmin: () => void; adminUnlocked: boolean; hideChrome?: boolean }) {
  return <div className="min-h-[100dvh] overflow-x-hidden"><div className="noise" />{!hideChrome && <header className="no-print relative z-10 border-b border-white/[0.07]"><div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-4 px-5 sm:px-8"><Logo onClick={onHome} /><div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#898997]"><span className="hidden lg:inline">A field guide for</span><span className="hidden sm:inline text-[#f7f0e4]">good games</span><span className="hidden sm:block h-2 w-2 rounded-full bg-[#42d1b1]" /><AuthControls onAdmin={onAdmin} adminUnlocked={adminUnlocked} /></div></div></header>}<main className="relative z-[1]">{children}</main>{!hideChrome && <footer className="no-print mx-auto grid max-w-[1180px] grid-cols-[1fr_auto_1fr] items-center border-t border-white/[0.07] px-5 py-8 text-xs text-[#777984] sm:px-8"><span className="font-mono tracking-tight">games.io / play more, search less</span><span className="justify-self-center font-mono text-[#f9be4b]">v1.4</span><span className="hidden justify-self-end sm:inline">A small, opinionated rules library.</span></footer>}</div>;
}

function SearchBox({ value, onChange, compact = false }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  return <div className={`group relative flex items-center rounded-2xl border border-white/[0.11] bg-[#171821]/90 shadow-[0_15px_50px_rgba(0,0,0,.22)] transition-colors focus-within:border-[#f9be4b]/70 ${compact ? 'h-12' : 'h-[68px]'}`}><Search className="ml-5 shrink-0 text-[#f9be4b]" size={compact ? 19 : 23} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search a game, nickname, or category..." className={`min-w-0 flex-1 bg-transparent px-4 text-[#f7f0e4] outline-none placeholder:text-[#777984] ${compact ? 'text-sm' : 'text-base sm:text-lg'}`} data-testid="input-game-search" aria-label="Search games" />{value && <button onClick={() => onChange('')} className="mr-3 rounded-lg p-2 text-[#777984] hover:bg-white/[0.07] hover:text-[#f7f0e4]" data-testid="button-clear-search"><X size={17} /></button>}{!compact && <span className="mr-4 hidden rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] text-[#777984] sm:block">TYPE TO FIND</span>}</div>;
}

function CategoryMark({ color, icon }: { color: string; icon: string }) {
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 font-mono text-lg font-bold" style={{ backgroundColor: `${color}18`, color }}>{icon}</span>;
}

function GameCard({ game, onOpen, index = 0, favorited = false, signedIn = false, onFavorite }: { game: Game; onOpen: (slug: string) => void; index?: number; favorited?: boolean; signedIn?: boolean; onFavorite?: (slug: string, value: boolean) => void }) {
  return <article className={`stagger-in stagger-${Math.min(index + 1, 5)} card-lift group flex min-h-[168px] flex-col justify-between rounded-2xl border border-white/[0.09] bg-[#171821]/80 p-5`} data-testid={`card-game-${game.slug}`}><div className="flex items-start justify-between gap-3"><button onClick={() => onOpen(game.slug)} aria-label={`Open ${game.title} guide`} className="text-left"><CategoryMark color={game.accent} icon={game.icon} /></button><div className="flex items-center gap-2"><FavoriteButton slug={game.slug} favorited={favorited} signedIn={signedIn} onToggle={onFavorite || (() => undefined)} /><button onClick={() => onOpen(game.slug)} aria-label={`Open ${game.title}`} className="text-[#666875] transition-all group-hover:translate-x-1 group-hover:text-[#f9be4b]" data-testid={`button-open-game-${game.slug}`}><ArrowRight size={18} /></button></div></div><button onClick={() => onOpen(game.slug)} className="mt-4 text-left"><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: game.accent }}>{game.eyebrow}</p><h3 className="text-xl font-semibold tracking-[-0.04em] text-[#f7f0e4]">{game.title}</h3><p className="mt-1 line-clamp-1 text-sm text-[#898997]">{game.description}</p></button></article>;
}

function CategoryCard({ slug, category, count, index, onOpen }: { slug: string; category?: GameCategory; count: number; index: number; onOpen: (slug: string) => void }) {
  if (!category) return null;
  return <button onClick={() => onOpen(slug)} className={`stagger-in stagger-${Math.min(index + 1, 5)} card-lift group relative min-h-[164px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#171821]/80 p-5 text-left`} data-testid={`card-category-${slug}`}><div className="absolute -right-7 -top-7 h-28 w-28 rounded-full opacity-10 blur-[1px]" style={{ backgroundColor: category.color }} /><div className="relative flex h-full flex-col justify-between"><div className="flex items-start justify-between"><CategoryMark color={category.color} icon={String(index + 1).padStart(2, '0')} /><ArrowRight size={18} className="text-[#666875] transition-transform group-hover:translate-x-1" /></div><div><h3 className="mt-4 text-xl font-semibold tracking-[-0.04em]">{category.name}</h3><div className="mt-1 flex items-center gap-2 text-sm text-[#898997]"><span>{category.description}</span><span className="h-1 w-1 rounded-full bg-[#666875]" /><span>{count} {count === 1 ? 'guide' : 'guides'}</span></div></div></div></button>;
}

function searchCatalog(query: string, games: Game[], categories: Record<string, GameCategory>) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return games;
  return games.filter((game) => [game.title, game.eyebrow, game.description, ...game.alternateNames, ...game.categorySlugs.map((slug) => categories[slug]?.name || '')].some((value) => value.toLowerCase().includes(normalized)));
}

function Home({ catalog, onCategory, onGame, favorites, signedIn, onFavorite }: { catalog: ReturnType<typeof useCatalog>['catalog']; onCategory: (slug: string) => void; onGame: (slug: string) => void; favorites: string[]; signedIn: boolean; onFavorite: (slug: string, value: boolean) => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCatalog(query, catalog.games, catalog.categories), [query, catalog.games, catalog.categories]);
  const searching = query.trim().length > 0;
  return <section className="page-enter mx-auto max-w-[1180px] px-5 pb-20 pt-16 sm:px-8 sm:pt-24"><div className="mx-auto max-w-[820px] text-center"><div className="stagger-in inline-flex items-center gap-2 rounded-full border border-[#f9be4b]/25 bg-[#f9be4b]/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f9be4b]"><Sparkles size={13} /> Ready when the table is</div><h1 className="stagger-in stagger-1 mt-6 text-[clamp(3.4rem,10vw,7.8rem)] font-semibold leading-[.88] tracking-[-0.095em] text-[#f7f0e4]">Find your<br /><span className="text-[#f9be4b]">next game.</span></h1><p className="stagger-in stagger-2 mx-auto mt-7 max-w-[500px] text-base leading-7 text-[#a2a2ae] sm:text-lg">Rules, setup, and a scorekeeper for the games people actually want to play.</p><div className="stagger-in stagger-3 mt-9 text-left"><SearchBox value={query} onChange={setQuery} /></div>{searching && <div className="stagger-in mt-6 text-left"><div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-[#777984]"><span>{results.length} {results.length === 1 ? 'guide' : 'guides'} found</span><button onClick={() => setQuery('')} className="text-[#f9be4b] hover:underline" data-testid="button-reset-search">Clear</button></div>{results.length ? <div className="grid gap-3 sm:grid-cols-2">{results.map((game, index) => <GameCard key={game.slug} game={game} onOpen={onGame} index={index} favorited={favorites.includes(game.slug)} signedIn={signedIn} onFavorite={onFavorite} />)}</div> : <EmptyState query={query} />}</div>}</div>{!searching && <><div className="stagger-in stagger-4 my-16 flex items-center gap-4"><span className="h-px flex-1 bg-white/[0.09]" /><span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#666875]">Explore by mood</span><span className="h-px flex-1 bg-white/[0.09]" /></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{catalog.primaryCategories.map((slug, index) => <CategoryCard key={slug} slug={slug} category={catalog.categories[slug]} count={catalog.games.filter((game) => game.categorySlugs.includes(slug)).length} index={index} onOpen={onCategory} />)}</div><div className="mt-16 grid gap-3 lg:grid-cols-[1.2fr_.8fr]"><button onClick={() => onGame('flip-7')} className="stagger-in stagger-4 group relative min-h-[230px] overflow-hidden rounded-2xl border border-[#f9be4b]/20 bg-[#302718] p-7 text-left" data-testid="button-featured-flip-7"><div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border-[28px] border-[#f9be4b]/10 transition-transform duration-500 group-hover:scale-110" /><div className="relative flex h-full flex-col justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f9be4b]">Tonight's quick pick</p><h2 className="mt-3 max-w-[380px] text-4xl font-semibold leading-none tracking-[-0.07em] text-[#f7f0e4]">Flip 7 is ready<br />when you are.</h2></div><span className="flex items-center gap-2 text-sm font-semibold text-[#f9be4b]">Open the guide <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span></div></button><div className="stagger-in stagger-5 rounded-2xl border border-white/[0.09] bg-[#12131a] p-7"><CircleHelp className="text-[#42d1b1]" size={24} /><h2 className="mt-5 text-2xl font-semibold tracking-[-0.05em]">No rulebook<br />archaeology.</h2><p className="mt-3 max-w-[280px] text-sm leading-6 text-[#898997]">Short, opinionated guides for the moment someone says, “Wait, how do we play this?”</p></div></div></>}</section>;
}

function EmptyState({ query }: { query: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center"><Filter className="mx-auto text-[#666875]" size={25} /><h3 className="mt-4 text-lg font-semibold">No match for “{query}”</h3><p className="mt-2 text-sm text-[#898997]">Try a shorter title, alternate name, or a broader category.</p></div>;
}

function Breadcrumbs({ path, categories, onNavigate }: { path: string[]; categories: Record<string, GameCategory>; onNavigate: (slug?: string) => void }) {
  return <div className="mb-8 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#777984]"><button onClick={() => onNavigate()} className="hover:text-[#f9be4b]" data-testid="button-breadcrumb-home">All games</button>{path.map((slug, index) => { const category = categories[slug]; if (!category) return null; return <span key={slug} className="flex items-center gap-2"><ChevronRight size={13} /><button onClick={() => onNavigate(slug)} className={index === path.length - 1 ? 'text-[#f7f0e4]' : 'hover:text-[#f9be4b]'} data-testid={`button-breadcrumb-${slug}`}>{category.name}</button></span>; })}</div>;
}

function CategoryView({ slug, catalog, onCategory, onGame, onBack, favorites, signedIn, onFavorite }: { slug: string; catalog: ReturnType<typeof useCatalog>['catalog']; onCategory: (slug: string) => void; onGame: (slug: string) => void; onBack: () => void; favorites: string[]; signedIn: boolean; onFavorite: (slug: string, value: boolean) => void }) {
  const category = catalog.categories[slug];
  if (!category) return <NotFound onHome={onBack} />;
  const gamesInCategory = catalog.games.filter((game) => game.categorySlugs.includes(slug));
  const parent = Object.values(catalog.categories).find((item) => item.children?.includes(slug));
  const crumbs = parent ? [parent.slug, slug] : [slug];
  const childSlugs = (category.children || []).filter((child) => Boolean(catalog.categories[child]));
  return <section className="page-enter mx-auto max-w-[1180px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16"><Breadcrumbs path={crumbs} categories={catalog.categories} onNavigate={(target) => target ? onCategory(target) : onBack()} /><button onClick={onBack} className="no-print mb-8 flex items-center gap-2 text-sm font-semibold text-[#a2a2ae] hover:text-[#f9be4b]" data-testid="button-category-back"><ArrowLeft size={16} /> Back</button><div className="max-w-[670px]"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} /><p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: category.color }}>Category field notes</p></div><h1 className="mt-4 text-5xl font-semibold tracking-[-0.08em] sm:text-7xl">{category.name}</h1><p className="mt-5 text-lg leading-8 text-[#a2a2ae]">{category.description}</p></div>{childSlugs.length ? <div className="mt-12"><p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Go deeper</p><div className="grid gap-3 sm:grid-cols-2">{childSlugs.map((child, index) => <CategoryCard key={child} slug={child} category={catalog.categories[child]} count={catalog.games.filter((game) => game.categorySlugs.includes(child)).length} index={index} onOpen={onCategory} />)}</div></div> : null}<div className="mt-12 border-t border-white/[0.09] pt-10"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Guides in this shelf</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{gamesInCategory.length ? `${gamesInCategory.length} game${gamesInCategory.length === 1 ? '' : 's'} to know` : 'Nothing here yet'}</h2></div></div>{gamesInCategory.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{gamesInCategory.map((game, index) => <GameCard key={game.slug} game={game} onOpen={onGame} index={index} favorited={favorites.includes(game.slug)} signedIn={signedIn} onFavorite={onFavorite} />)}</div> : <EmptyState query={category.name} />}</div></section>;
}

function Scorekeeper() {
  const [names, setNames] = useState(['You', 'Player 2']);
  const [scores, setScores] = useState([0, 0]);
  const addPlayer = () => { if (names.length < 8) { setNames([...names, `Player ${names.length + 1}`]); setScores([...scores, 0]); } };
  return <div className="print-card rounded-2xl border border-white/[0.09] bg-[#171821]/75 p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#42d1b1]">Live scorekeeper</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Keep the table honest.</h2></div><button onClick={() => setScores(scores.map(() => 0))} className="pressable flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae] hover:border-[#f9be4b]/50 hover:text-[#f9be4b]" data-testid="button-reset-scores"><RotateCcw size={14} /> Reset</button></div><div className="mt-6 space-y-2">{names.map((name, index) => <div key={`${name}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#12131a] p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="font-mono text-[11px] text-[#777984]">PLAYER {String(index + 1).padStart(2, '0')}</p></div><button onClick={() => setScores((current) => current.map((score, scoreIndex) => scoreIndex === index ? score - 1 : score))} className="pressable grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06] text-[#a2a2ae] hover:bg-white/[0.13]" data-testid={`button-score-minus-${index}`}><Minus size={16} /></button><span className="w-12 text-center font-mono text-xl font-bold text-[#f9be4b]" data-testid={`text-score-${index}`}>{scores[index]}</span><button onClick={() => setScores((current) => current.map((score, scoreIndex) => scoreIndex === index ? score + 1 : score))} className="pressable grid h-9 w-9 place-items-center rounded-lg bg-[#f9be4b] text-[#171821] hover:bg-[#ffd47e]" data-testid={`button-score-plus-${index}`}><Plus size={16} /></button></div>)}</div><button onClick={addPlayer} disabled={names.length >= 8} className="no-print mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-sm font-semibold text-[#898997] transition-colors hover:border-[#42d1b1]/60 hover:text-[#42d1b1] disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-add-player"><Plus size={16} /> Add player</button><p className="mt-4 text-center text-[11px] leading-5 text-[#666875]">Scores stay in this tab and reset when you refresh.</p></div>;
}

function GameView({ game, catalog, adminUnlocked, onBack, onCategory, onRemoveInventory, favorites, signedIn, onFavorite, username }: { game: Game; catalog: ReturnType<typeof useCatalog>['catalog']; adminUnlocked: boolean; onBack: () => void; onCategory: (slug: string) => void; onRemoveInventory: (gameSlug: string, itemId: string) => void; favorites: string[]; signedIn: boolean; onFavorite: (slug: string, value: boolean) => void; username: string }) {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => { try { await navigator.clipboard?.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } };
  return <section className="page-enter mx-auto max-w-[1180px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14" data-testid={`page-guide-${game.slug}`}><div className="no-print mb-8 flex items-center justify-between gap-4"><button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-[#a2a2ae] hover:text-[#f9be4b]" data-testid="button-game-back"><ArrowLeft size={16} /> Back to guides</button><div className="flex flex-wrap justify-end gap-2"><FavoriteButton slug={game.slug} favorited={favorites.includes(game.slug)} signedIn={signedIn} onToggle={onFavorite} /><button onClick={copyLink} className="pressable flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae] hover:text-[#f7f0e4]" data-testid="button-copy-link"><Copy size={14} /> {copied ? 'Copied' : 'Copy link'}</button><button onClick={() => window.print()} className="pressable flex items-center gap-2 rounded-xl bg-[#f9be4b] px-3 py-2 text-xs font-bold text-[#171821] hover:bg-[#ffd47e]" data-testid="button-print-guide"><Printer size={14} /> Print / PDF</button></div></div><div className="print-only mb-8"><p className="font-mono text-sm">games.io / field guide</p></div><div className="grid gap-8 lg:grid-cols-[1fr_310px] lg:items-start"><div><div className="flex flex-wrap items-center gap-2">{game.categorySlugs.map((slug) => catalog.categories[slug] ? <button key={slug} onClick={() => onCategory(slug)} className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a2a2ae] hover:border-[#f9be4b]/50 hover:text-[#f9be4b]" data-testid={`button-game-category-${slug}`}>{catalog.categories[slug].name}</button> : null)}</div><p className="mt-8 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: game.accent }}>{game.eyebrow}</p><h1 className="mt-4 text-[clamp(3.8rem,9vw,7.2rem)] font-semibold leading-[.88] tracking-[-0.1em]">{game.title}</h1><p className="mt-7 max-w-[660px] text-lg leading-8 text-[#a2a2ae]">{game.description}</p><div className="no-print mt-6 flex flex-wrap items-center gap-3"><StartGameButton game={game} signedIn={signedIn} username={username} /><span className="text-xs text-[#777984]">Configured scorekeeper · 2–8 players</span></div><div className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-4"><InfoCell icon={<Users size={17} />} label="Players" value={game.players} /><InfoCell icon={<Clock3 size={17} />} label="Play time" value={game.duration} /><InfoCell icon={<Sparkles size={17} />} label="Setup" value={game.setup} /><InfoCell icon={<CircleHelp size={17} />} label="Age" value={game.age} /></div><div className="mt-12 border-t border-white/[0.09] pt-10"><h2 className="text-3xl font-semibold tracking-[-0.06em]">The quick version</h2><p className="mt-5 max-w-[720px] text-lg leading-8 text-[#c2c0c0]">{game.objective}</p></div><div className="mt-12 border-t border-white/[0.09] pt-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Before you start</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em]">On the table</h2><div className="mt-6 flex flex-wrap gap-2">{game.equipment.map((item) => <span key={item} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[#c2c0c0]">{item}</span>)}</div></div><div className="mt-12 border-t border-white/[0.09] pt-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Rules, in order</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em]">How to play</h2><ol className="mt-7 space-y-5">{game.rules.map((rule, index) => <li key={`${rule}-${index}`} className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-xs font-bold" style={{ backgroundColor: `${game.accent}20`, color: game.accent }}>{String(index + 1).padStart(2, '0')}</span><p className="pt-1 text-[15px] leading-7 text-[#c2c0c0]">{rule}</p></li>)}</ol></div><ArticleMarkdown markdown={game.articleMarkdown} /><InventoryBank game={game} items={catalog.inventory[game.slug] || []} adminUnlocked={adminUnlocked} onRemove={(itemId) => onRemoveInventory(game.slug, itemId)} /></div><aside className="lg:sticky lg:top-6"><div className="rounded-2xl border border-[#42d1b1]/20 bg-[#121a19] p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#42d1b1]">Ready to play</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em]">A table, not a timer.</h2><p className="mt-2 text-sm leading-6 text-[#a2a2ae]">Choose a configured scorekeeper, variation, and players before the first turn.</p><p className="mt-5 rounded-xl border border-white/10 px-3 py-3 text-xs leading-5 text-[#a2a2ae]">Your table is saved with its players, date, mode, and notes.</p></div><p className="mt-4 text-center text-[11px] leading-5 text-[#666875]">Your game history and favorites stay with your profile.</p></aside></div><div className="print-only mt-10 border-t border-gray-300 pt-4 text-xs">Guide saved from games.io • {game.title}</div></section>;
}

function InfoCell({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="bg-[#171821] p-4"><div className="flex items-center gap-2 text-[#f9be4b]">{icon}<span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#777984]">{label}</span></div><p className="mt-2 text-sm font-semibold text-[#f7f0e4]">{value}</p></div>;
}

function NotFound({ onHome }: { onHome: () => void }) {
  return <div className="mx-auto flex min-h-[65vh] max-w-[600px] flex-col items-center justify-center px-5 text-center"><p className="font-mono text-6xl font-bold text-[#f9be4b]">404</p><h1 className="mt-4 text-3xl font-semibold">That guide wandered off.</h1><p className="mt-3 text-[#898997]">The page you requested is not in this little library.</p><button onClick={onHome} className="mt-7 rounded-xl bg-[#f9be4b] px-5 py-3 text-sm font-bold text-[#171821] hover:bg-[#ffd47e]" data-testid="button-not-found-home">Back to games</button></div>;
}

function AdminSignedOut({ onHome }: { onHome: () => void }) {
  return <div className="mx-auto flex min-h-[65vh] max-w-[520px] flex-col items-center justify-center px-5 text-center"><LockKeyhole className="text-[#f9be4b]" size={30} /><h1 className="mt-5 text-3xl font-semibold tracking-[-0.06em]">Admin is a signed-in room.</h1><p className="mt-3 text-[#898997]">Sign in to access the local catalog desk. The public field guide stays open to everyone.</p><Link href="/sign-in" className="mt-7 rounded-xl bg-[#f9be4b] px-5 py-3 text-sm font-bold text-[#171821]" data-testid="link-admin-sign-in">Sign in to continue</Link><button onClick={onHome} className="mt-4 text-sm font-semibold text-[#a2a2ae] hover:text-[#f9be4b]" data-testid="button-admin-back">Back to games</button></div>;
}

function AppContent() {
  const [location, setLocation] = useLocation();
  const { user } = useUser();
  const { catalog, loadState: catalogLoadState, retryLoad: retryCatalogLoad, saveState: catalogSaveState, retrySave: retryCatalogSave, addCategory, removeCategory, addGame, updateGame, removeGame, addInventoryItem, removeInventoryItem, resetCatalog } = useCatalog();
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [profileUsername, setProfileUsername] = useState('');
  const [favoriteNotice, setFavoriteNotice] = useState('');
  const userId = user?.id;
  const currentUserId = useRef(userId);
  currentUserId.current = userId;
  useEffect(() => {
    let active = true;
    setFavorites([]); setProfileUsername('');
    if (userId) void getProfile().then((profile) => { if (active) { setFavorites(profile.favorites); setProfileUsername(profile.username); } }).catch(() => undefined);
    return () => { active = false; };
  }, [userId]);
  const toggleFavorite = async (gameSlug: string, favorited: boolean) => {
    if (!userId) { setLocation('/sign-in'); return; }
    setFavoriteNotice('');
    try {
      const result = await setGameFavorite(gameSlug, { favorited });
      if (userId !== currentUserId.current) return;
      setFavorites((current) => result.favorited ? Array.from(new Set([...current, gameSlug])) : current.filter((slug) => slug !== gameSlug));
      setFavoriteNotice(result.favorited ? 'Guide saved to your favorites.' : 'Guide removed from your favorites.');
    } catch { setFavoriteNotice('Favorite could not be updated. Try again.'); }
  };
  useEffect(() => {
    let active = true;
    setAdminUnlocked(false);
    if (userId) void getCatalogAdminStatus().then((result) => { if (active) setAdminUnlocked(result.unlocked); }).catch(() => undefined);
    return () => { active = false; };
  }, [userId]);
  const unlockAdmin = async (password: string) => {
    const result = await unlockCatalogAdmin({ password });
    setAdminUnlocked(result.unlocked);
    return result.unlocked;
  };
  const uploadInventoryImage = async (file: File) => {
    const result = await requestUploadUrl({ name: file.name, size: file.size, contentType: file.type });
    const upload = await fetch(result.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!upload.ok) throw new Error('Image upload failed');
    return result.objectPath;
  };
  const path = location.split('?')[0];
  const [, segment, slug] = path.split('/');
  const segments = path.split('/');
  const goHome = () => setLocation('/');
  const goCategory = (categorySlug: string) => setLocation(`/category/${categorySlug}`);
  const goGame = (gameSlug: string) => setLocation(`/game/${gameSlug}`);
  const game = segment === 'game' && slug ? catalog.games.find((item) => item.slug === slug) : undefined;
  const playSessionId = segment === 'game' && segments[3] === 'play' ? segments[4] : undefined;
  const onAdmin = () => { setAdminOpen(true); if (path !== '/admin') setLocation('/admin'); };
  const isAdminRoute = path === '/admin';
  const content = playSessionId && slug
    ? <GamePlayPage slug={slug} sessionId={playSessionId} signedIn={Boolean(user)} />
    : path === '/profile'
      ? user ? <ProfilePage games={catalog.games} favorites={favorites} onFavorite={toggleFavorite} /> : <div className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-5 text-center" data-testid="status-profile-sign-in"><h1 className="text-3xl font-semibold">Your games, in one place.</h1><p className="mt-3 text-sm text-[#898997]">Sign in to see favorites, scores, and past tables.</p><Link href="/sign-in" className="mt-6 rounded-xl bg-[#f9be4b] px-5 py-3 text-sm font-bold text-[#171821]" data-testid="link-profile-sign-in">Sign in</Link></div>
    : segment === 'category' && slug
    ? <CategoryView slug={slug} catalog={catalog} onCategory={goCategory} onGame={goGame} onBack={goHome} favorites={favorites} signedIn={Boolean(user)} onFavorite={toggleFavorite} />
    : game
      ? <GameView game={game} catalog={catalog} adminUnlocked={adminUnlocked} onBack={goHome} onCategory={goCategory} onRemoveInventory={removeInventoryItem} favorites={favorites} signedIn={Boolean(user)} onFavorite={toggleFavorite} username={profileUsername || user?.username || 'You'} />
      : path === '/'
        ? <Home catalog={catalog} onCategory={goCategory} onGame={goGame} favorites={favorites} signedIn={Boolean(user)} onFavorite={toggleFavorite} />
        : isAdminRoute && !user
          ? <AdminSignedOut onHome={goHome} />
          : isAdminRoute
            ? <Home catalog={catalog} onCategory={goCategory} onGame={goGame} favorites={favorites} signedIn={Boolean(user)} onFavorite={toggleFavorite} />
            : <NotFound onHome={goHome} />;
  const catalogSurface = catalogLoadState === 'loaded' ? content : catalogLoadState === 'loading'
    ? <div className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center px-5 text-center text-sm text-[#898997]" role="status">Loading the saved game library…</div>
    : <div className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-5 text-center" role="alert"><h1 className="text-2xl font-semibold">The saved game library could not be loaded.</h1><p className="mt-3 text-sm text-[#898997]">Your saved articles were kept safe. Try again before editing the catalog.</p><button onClick={() => void retryCatalogLoad()} className="mt-6 rounded-xl bg-[#f9be4b] px-5 py-3 text-sm font-bold text-[#171821]" data-testid="button-retry-catalog-load">Try again</button></div>;
  const adminPanel = user && catalogLoadState === 'loaded' && <AdminPanel categories={catalog.categories} primaryCategories={catalog.primaryCategories} games={catalog.games} inventory={catalog.inventory} catalogSaveState={catalogSaveState} onRetryCatalogSave={retryCatalogSave} unlocked={adminUnlocked} onUnlock={unlockAdmin} onClose={() => { setAdminOpen(false); goHome(); }} onAddCategory={addCategory} onRemoveCategory={removeCategory} onAddGame={addGame} onUpdateGame={updateGame} onRemoveGame={removeGame} onAddInventory={addInventoryItem} onUploadImage={uploadInventoryImage} onRemoveInventory={removeInventoryItem} onReset={resetCatalog} />;
  const showingAdminPanel = Boolean(adminPanel && (isAdminRoute || adminOpen));
  return <Shell onHome={goHome} onAdmin={onAdmin} adminUnlocked={adminUnlocked} hideChrome={showingAdminPanel}>{favoriteNotice && <div role="status" className="mx-auto mt-4 max-w-[1180px] px-5 text-xs text-[#42d1b1]" data-testid="status-favorite-feedback">{favoriteNotice}</div>}{catalogSurface}{isAdminRoute && adminPanel}{adminOpen && !isAdminRoute && adminPanel}</Shell>;
}

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0f1016] px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0f1016] px-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Keep the table moving.' } }, signUp: { start: { title: 'Join the table', subtitle: 'Save a field guide identity.' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}><Switch><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route component={AppContent} /></Switch></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;