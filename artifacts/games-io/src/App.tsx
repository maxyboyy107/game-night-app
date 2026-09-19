import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, CircleHelp, Clock3, Copy, Filter, Gamepad2, Minus, Plus, Printer, RotateCcw, Search, Sparkles, Users, X } from 'lucide-react';
import { Router as WouterRouter, useLocation } from 'wouter';
import { categories, games, gamesForCategory, getCategory, getGame, primaryCategories, searchGames, type Game } from './data/games';

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-3 text-left" data-testid="button-brand-home">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-[#f9be4b] text-[#171821] shadow-[0_7px_0_#bb842b] transition-transform group-hover:-translate-y-0.5 group-active:translate-y-0.5 group-active:shadow-[0_3px_0_#bb842b]">
        <Gamepad2 size={20} strokeWidth={2.6} />
      </span>
      <span className="font-mono text-lg font-bold tracking-[-0.08em] text-[#f7f0e4]">games<span className="text-[#f9be4b]">.io</span></span>
    </button>
  );
}

function Shell({ children, onHome }: { children: React.ReactNode; onHome: () => void }) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden">
      <div className="noise" />
      <header className="no-print relative z-10 border-b border-white/[0.07]">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Logo onClick={onHome} />
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#898997]">
            <span className="hidden sm:inline">A field guide for</span>
            <span className="text-[#f7f0e4]">good games</span>
            <span className="ml-1 h-2 w-2 rounded-full bg-[#42d1b1]" />
          </div>
        </div>
      </header>
      <main className="relative z-[1]">{children}</main>
      <footer className="no-print mx-auto flex max-w-[1180px] items-center justify-between border-t border-white/[0.07] px-5 py-8 text-xs text-[#777984] sm:px-8">
        <span className="font-mono tracking-tight">games.io / play more, search less</span>
        <span className="hidden sm:inline">A small, opinionated rules library.</span>
      </footer>
    </div>
  );
}

function SearchBox({ value, onChange, compact = false }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  return (
    <div className={`group relative flex items-center rounded-2xl border border-white/[0.11] bg-[#171821]/90 shadow-[0_15px_50px_rgba(0,0,0,.22)] transition-colors focus-within:border-[#f9be4b]/70 ${compact ? 'h-12' : 'h-[68px]'}`}>
      <Search className="ml-5 shrink-0 text-[#f9be4b]" size={compact ? 19 : 23} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search a game, nickname, or category..."
        className={`min-w-0 flex-1 bg-transparent px-4 text-[#f7f0e4] outline-none placeholder:text-[#777984] ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}
        data-testid="input-game-search"
        aria-label="Search games"
      />
      {value && <button onClick={() => onChange('')} className="mr-3 rounded-lg p-2 text-[#777984] hover:bg-white/[0.07] hover:text-[#f7f0e4]" data-testid="button-clear-search"><X size={17} /></button>}
      {!compact && <span className="mr-4 hidden rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] text-[#777984] sm:block">TYPE TO FIND</span>}
    </div>
  );
}

function CategoryMark({ color, icon }: { color: string; icon: string }) {
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 font-mono text-lg font-bold" style={{ backgroundColor: `${color}18`, color }}>{icon}</span>;
}

function GameCard({ game, onOpen, index = 0 }: { game: Game; onOpen: (slug: string) => void; index?: number }) {
  return (
    <button
      onClick={() => onOpen(game.slug)}
      className={`stagger-in stagger-${Math.min(index + 1, 5)} card-lift group flex min-h-[168px] flex-col justify-between rounded-2xl border border-white/[0.09] bg-[#171821]/80 p-5 text-left`}
      data-testid={`card-game-${game.slug}`}
    >
      <div className="flex items-start justify-between gap-3">
        <CategoryMark color={game.accent} icon={game.icon} />
        <ArrowUpRight />
      </div>
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: game.accent }}>{game.eyebrow}</p>
        <h3 className="text-xl font-semibold tracking-[-0.04em] text-[#f7f0e4]">{game.title}</h3>
        <p className="mt-1 line-clamp-1 text-sm text-[#898997]">{game.description}</p>
      </div>
    </button>
  );
}

function ArrowUpRight() {
  return <ArrowRight size={18} className="text-[#666875] transition-all group-hover:translate-x-1 group-hover:text-[#f9be4b]" />;
}

function CategoryCard({ slug, index, onOpen }: { slug: string; index: number; onOpen: (slug: string) => void }) {
  const category = categories[slug];
  const count = gamesForCategory(slug).length;
  return (
    <button onClick={() => onOpen(slug)} className={`stagger-in stagger-${index + 1} card-lift group relative min-h-[164px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#171821]/80 p-5 text-left`} data-testid={`card-category-${slug}`}>
      <div className="absolute -right-7 -top-7 h-28 w-28 rounded-full opacity-10 blur-[1px]" style={{ backgroundColor: category.color }} />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <CategoryMark color={category.color} icon={['01', '02', '03', '04'][index]} />
          <ArrowRight size={18} className="text-[#666875] transition-transform group-hover:translate-x-1" />
        </div>
        <div>
          <h3 className="mt-4 text-xl font-semibold tracking-[-0.04em]">{category.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-[#898997]"><span>{category.description}</span><span className="h-1 w-1 rounded-full bg-[#666875]" /><span>{count} {count === 1 ? 'guide' : 'guides'}</span></div>
        </div>
      </div>
    </button>
  );
}

function Home({ onCategory, onGame }: { onCategory: (slug: string) => void; onGame: (slug: string) => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchGames(query), [query]);
  const searching = query.trim().length > 0;
  return (
    <section className="page-enter mx-auto max-w-[1180px] px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
      <div className="mx-auto max-w-[820px] text-center">
        <div className="stagger-in inline-flex items-center gap-2 rounded-full border border-[#f9be4b]/25 bg-[#f9be4b]/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f9be4b]"><Sparkles size={13} /> Ready when the table is</div>
        <h1 className="stagger-in stagger-1 mt-6 text-[clamp(3.4rem,10vw,7.8rem)] font-semibold leading-[.88] tracking-[-0.095em] text-[#f7f0e4]">Find your<br /><span className="text-[#f9be4b]">next game.</span></h1>
        <p className="stagger-in stagger-2 mx-auto mt-7 max-w-[500px] text-base leading-7 text-[#a2a2ae] sm:text-lg">Rules, setup, and a scorekeeper for the games people actually want to play.</p>
        <div className="stagger-in stagger-3 mt-9 text-left"><SearchBox value={query} onChange={setQuery} /></div>
        {searching && (
          <div className="stagger-in mt-6 text-left">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-[#777984]"><span>{results.length} {results.length === 1 ? 'guide' : 'guides'} found</span><button onClick={() => setQuery('')} className="text-[#f9be4b] hover:underline" data-testid="button-reset-search">Clear</button></div>
            {results.length ? <div className="grid gap-3 sm:grid-cols-2"><>{results.map((game, index) => <GameCard key={game.slug} game={game} onOpen={onGame} index={index} />)}</></div> : <EmptyState query={query} />}
          </div>
        )}
      </div>
      {!searching && <><div className="stagger-in stagger-4 my-16 flex items-center gap-4"><span className="h-px flex-1 bg-white/[0.09]" /><span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#666875]">Explore by mood</span><span className="h-px flex-1 bg-white/[0.09]" /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{primaryCategories.map((slug, index) => <CategoryCard key={slug} slug={slug} index={index} onOpen={onCategory} />)}</div>
        <div className="mt-16 grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
          <button onClick={() => onGame('flip-7')} className="stagger-in stagger-4 group relative min-h-[230px] overflow-hidden rounded-2xl border border-[#f9be4b]/20 bg-[#302718] p-7 text-left" data-testid="button-featured-flip-7">
            <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border-[28px] border-[#f9be4b]/10 transition-transform duration-500 group-hover:scale-110" />
            <div className="relative flex h-full flex-col justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f9be4b]">Tonight's quick pick</p><h2 className="mt-3 max-w-[380px] text-4xl font-semibold leading-none tracking-[-0.07em] text-[#f7f0e4]">Flip 7 is ready<br />when you are.</h2></div><span className="flex items-center gap-2 text-sm font-semibold text-[#f9be4b]">Open the guide <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span></div>
          </button>
          <div className="stagger-in stagger-5 rounded-2xl border border-white/[0.09] bg-[#12131a] p-7">
            <CircleHelp className="text-[#42d1b1]" size={24} />
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.05em]">No rulebook<br />archaeology.</h2>
            <p className="mt-3 max-w-[280px] text-sm leading-6 text-[#898997]">Short, opinionated guides for the moment someone says, “Wait, how do we play this?”</p>
          </div>
        </div>
      </>}
    </section>
  );
}

function EmptyState({ query }: { query: string }) {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center"><Filter className="mx-auto text-[#666875]" size={25} /><h3 className="mt-4 text-lg font-semibold">No match for “{query}”</h3><p className="mt-2 text-sm text-[#898997]">Try a shorter title, alternate name, or a broader category.</p></div>;
}

function Breadcrumbs({ path, onNavigate }: { path: string[]; onNavigate: (slug?: string) => void }) {
  return <div className="mb-8 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#777984]"><button onClick={() => onNavigate()} className="hover:text-[#f9be4b]" data-testid="button-breadcrumb-home">All games</button>{path.map((slug, index) => <span key={slug} className="flex items-center gap-2"><ChevronRight size={13} /> <button onClick={() => onNavigate(slug)} className={index === path.length - 1 ? 'text-[#f7f0e4]' : 'hover:text-[#f9be4b]'} data-testid={`button-breadcrumb-${slug}`}>{getCategory(slug)?.name}</button></span>)}</div>;
}

function CategoryView({ slug, onCategory, onGame, onBack }: { slug: string; onCategory: (slug: string) => void; onGame: (slug: string) => void; onBack: () => void }) {
  const category = getCategory(slug);
  if (!category) return <NotFound onHome={onBack} />;
  const gamesInCategory = gamesForCategory(slug);
  const parent = Object.values(categories).find((item) => item.children?.includes(slug));
  const crumbs = parent ? [parent.slug, slug] : [slug];
  return <section className="page-enter mx-auto max-w-[1180px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
    <Breadcrumbs path={crumbs} onNavigate={(target) => target ? onCategory(target) : onBack()} />
    <button onClick={onBack} className="no-print mb-8 flex items-center gap-2 text-sm font-semibold text-[#a2a2ae] hover:text-[#f9be4b]" data-testid="button-category-back"><ArrowLeft size={16} /> Back</button>
    <div className="max-w-[670px]"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} /><p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: category.color }}>Category field notes</p></div><h1 className="mt-4 text-5xl font-semibold tracking-[-0.08em] sm:text-7xl">{category.name}</h1><p className="mt-5 text-lg leading-8 text-[#a2a2ae]">{category.description}</p></div>
    {category.children?.length ? <div className="mt-12"><p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Go deeper</p><div className="grid gap-3 sm:grid-cols-2">{category.children.map((child, index) => <CategoryCard key={child} slug={child} index={index} onOpen={onCategory} />)}</div></div> : null}
    <div className="mt-12 border-t border-white/[0.09] pt-10"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Guides in this shelf</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{gamesInCategory.length ? `${gamesInCategory.length} game${gamesInCategory.length === 1 ? '' : 's'} to know` : 'Nothing here yet'}</h2></div></div>{gamesInCategory.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{gamesInCategory.map((game, index) => <GameCard key={game.slug} game={game} onOpen={onGame} index={index} />)}</div> : <EmptyState query={category.name} />}</div>
  </section>;
}

function Scorekeeper({ game }: { game: Game }) {
  const [names, setNames] = useState(['You', 'Player 2']);
  const [scores, setScores] = useState([0, 0]);
  const addPlayer = () => { if (names.length < 8) { setNames([...names, `Player ${names.length + 1}`]); setScores([...scores, 0]); } };
  const updateScore = (index: number, amount: number) => setScores((current) => current.map((score, scoreIndex) => scoreIndex === index ? score + amount : score));
  return <div className="print-card rounded-2xl border border-white/[0.09] bg-[#171821]/75 p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#42d1b1]">Live scorekeeper</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Keep the table honest.</h2></div><button onClick={() => setScores(scores.map(() => 0))} className="pressable flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae] hover:border-[#f9be4b]/50 hover:text-[#f9be4b]" data-testid="button-reset-scores"><RotateCcw size={14} /> Reset</button></div>
    <div className="mt-6 space-y-2">{names.map((name, index) => <div key={`${name}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#12131a] p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="font-mono text-[11px] text-[#777984]">PLAYER {String(index + 1).padStart(2, '0')}</p></div><button onClick={() => updateScore(index, -1)} className="pressable grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06] text-[#a2a2ae] hover:bg-white/[0.13]" data-testid={`button-score-minus-${index}`}><Minus size={16} /></button><span className="w-12 text-center font-mono text-xl font-bold text-[#f9be4b]" data-testid={`text-score-${index}`}>{scores[index]}</span><button onClick={() => updateScore(index, 1)} className="pressable grid h-9 w-9 place-items-center rounded-lg bg-[#f9be4b] text-[#171821] hover:bg-[#ffd47e]" data-testid={`button-score-plus-${index}`}><Plus size={16} /></button></div>)}</div>
    <button onClick={addPlayer} disabled={names.length >= 8} className="no-print mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-sm font-semibold text-[#898997] transition-colors hover:border-[#42d1b1]/60 hover:text-[#42d1b1] disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-add-player"><Plus size={16} /> Add player</button>
    <p className="mt-4 text-center text-[11px] leading-5 text-[#666875]">Scores stay in this tab and reset when you refresh.</p>
  </div>;
}

function GameView({ game, onBack, onCategory }: { game: Game; onBack: () => void; onCategory: (slug: string) => void }) {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => { try { await navigator.clipboard?.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } };
  return <section className="page-enter mx-auto max-w-[1180px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
    <div className="no-print mb-8 flex items-center justify-between gap-4"><button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-[#a2a2ae] hover:text-[#f9be4b]" data-testid="button-game-back"><ArrowLeft size={16} /> Back to guides</button><div className="flex gap-2"><button onClick={copyLink} className="pressable flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae] hover:text-[#f7f0e4]" data-testid="button-copy-link"><Copy size={14} /> {copied ? 'Copied' : 'Copy link'}</button><button onClick={() => window.print()} className="pressable flex items-center gap-2 rounded-xl bg-[#f9be4b] px-3 py-2 text-xs font-bold text-[#171821] hover:bg-[#ffd47e]" data-testid="button-print-guide"><Printer size={14} /> Print / PDF</button></div></div>
    <div className="print-only mb-8"><p className="font-mono text-sm">games.io / field guide</p></div>
    <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
      <div>
        <div className="flex flex-wrap items-center gap-2">{game.categorySlugs.map((slug) => <button key={slug} onClick={() => onCategory(slug)} className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a2a2ae] hover:border-[#f9be4b]/50 hover:text-[#f9be4b]" data-testid={`button-game-category-${slug}`}>{getCategory(slug)?.name}</button>)}</div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: game.accent }}>{game.eyebrow}</p>
        <h1 className="mt-4 text-[clamp(3.8rem,9vw,7.2rem)] font-semibold leading-[.88] tracking-[-0.1em]">{game.title}</h1>
        <p className="mt-7 max-w-[660px] text-lg leading-8 text-[#a2a2ae]">{game.description}</p>
        <div className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-4"><InfoCell icon={<Users size={17} />} label="Players" value={game.players} /><InfoCell icon={<Clock3 size={17} />} label="Play time" value={game.duration} /><InfoCell icon={<Sparkles size={17} />} label="Setup" value={game.setup} /><InfoCell icon={<CircleHelp size={17} />} label="Age" value={game.age} /></div>
        <div className="mt-12 border-t border-white/[0.09] pt-10"><h2 className="text-3xl font-semibold tracking-[-0.06em]">The quick version</h2><p className="mt-5 max-w-[720px] text-lg leading-8 text-[#c2c0c0]">{game.objective}</p></div>
        <div className="mt-12 border-t border-white/[0.09] pt-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Before you start</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em]">On the table</h2><div className="mt-6 flex flex-wrap gap-2">{game.equipment.map((item) => <span key={item} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[#c2c0c0]">{item}</span>)}</div></div>
        <div className="mt-12 border-t border-white/[0.09] pt-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Rules, in order</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em]">How to play</h2><ol className="mt-7 space-y-5">{game.rules.map((rule, index) => <li key={rule} className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-xs font-bold" style={{ backgroundColor: `${game.accent}20`, color: game.accent }}>{String(index + 1).padStart(2, '0')}</span><p className="pt-1 text-[15px] leading-7 text-[#c2c0c0]">{rule}</p></li>)}</ol></div>
      </div>
      <aside className="lg:sticky lg:top-6"><Scorekeeper game={game} /></aside>
    </div>
    <div className="print-only mt-10 border-t border-gray-300 pt-4 text-xs">Guide saved from games.io • {game.title}</div>
  </section>;
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="bg-[#171821] p-4"><div className="flex items-center gap-2 text-[#f9be4b]">{icon}<span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#777984]">{label}</span></div><p className="mt-2 text-sm font-semibold text-[#f7f0e4]">{value}</p></div>;
}

function NotFound({ onHome }: { onHome: () => void }) {
  return <div className="mx-auto flex min-h-[65vh] max-w-[600px] flex-col items-center justify-center px-5 text-center"><p className="font-mono text-6xl font-bold text-[#f9be4b]">404</p><h1 className="mt-4 text-3xl font-semibold">That guide wandered off.</h1><p className="mt-3 text-[#898997]">The page you requested is not in this little library.</p><button onClick={onHome} className="mt-7 rounded-xl bg-[#f9be4b] px-5 py-3 text-sm font-bold text-[#171821] hover:bg-[#ffd47e]" data-testid="button-not-found-home">Back to games</button></div>;
}

function AppContent() {
  const [location, setLocation] = useLocation();
  const path = location.split('?')[0];
  const [, segment, slug] = path.split('/');
  const goHome = () => setLocation('/');
  const goCategory = (categorySlug: string) => setLocation(`/category/${categorySlug}`);
  const goGame = (gameSlug: string) => setLocation(`/game/${gameSlug}`);
  const game = segment === 'game' && slug ? getGame(slug) : undefined;
  return <Shell onHome={goHome}>{segment === 'category' && slug ? <CategoryView slug={slug} onCategory={goCategory} onGame={goGame} onBack={goHome} /> : game ? <GameView game={game} onBack={goHome} onCategory={goCategory} /> : path === '/' ? <Home onCategory={goCategory} onGame={goGame} /> : <NotFound onHome={goHome} />}</Shell>;
}

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppContent /></WouterRouter>;
}

export default App;
