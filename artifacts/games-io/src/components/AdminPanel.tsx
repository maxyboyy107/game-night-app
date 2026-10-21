import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Bold, Check, Download, Heading2, ImagePlus, Italic, List, ListOrdered, LockKeyhole, Plus, RotateCcw, Trash2, Underline, Upload, X } from 'lucide-react';
import type { Game, GameCategory } from '../data/games';
import type { InventoryItem } from '../data/catalog';
import { exportCatalogBackup, restoreCatalogBackup } from '@workspace/api-client-react';
import type { CatalogBackup, ScorekeeperMode } from '@workspace/api-client-react';

type AdminPanelProps = {
  categories: Record<string, GameCategory>;
  primaryCategories: string[];
  games: Game[];
  inventory: Record<string, InventoryItem[]>;
  catalogSaveState: 'saved' | 'saving' | 'error';
  onRetryCatalogSave: () => void;
  unlocked: boolean;
  onUnlock: (password: string) => Promise<boolean>;
  onClose: () => void;
  onAddCategory: (input: Omit<GameCategory, 'slug'> & { slug?: string; parentSlug?: string; primary?: boolean }) => void;
  onRemoveCategory: (slug: string) => void;
  onAddGame: (game: Game) => void;
  onUpdateGame: (slug: string, patch: Partial<Game>) => void;
  onRemoveGame: (slug: string) => void;
  onAddInventory: (gameSlug: string, item: InventoryItem) => void;
  onUploadImage: (file: File) => Promise<string>;
  onRemoveInventory: (gameSlug: string, itemId: string) => void;
  onReset: () => void;
};

const blankGame: Game = { slug: '', title: '', alternateNames: [], categorySlugs: [], eyebrow: 'Field note', description: '', players: '', setup: '', age: '', duration: '', equipment: [], objective: '', rules: [], accent: '#f9be4b', icon: '?' };

export function AdminPanel(props: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryColor, setCategoryColor] = useState('#42d1b1');
  const [categoryParent, setCategoryParent] = useState('');
  const [newGame, setNewGame] = useState<Game>(blankGame);
  const [selectedGame, setSelectedGame] = useState(props.games[0]?.slug || '');
  const [inventoryName, setInventoryName] = useState('');
  const [inventoryDescription, setInventoryDescription] = useState('');
  const [inventoryImage, setInventoryImage] = useState('');
  const [inventoryFile, setInventoryFile] = useState<File>();
  const [uploading, setUploading] = useState(false);
  const [articleError, setArticleError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const articleInput = useRef<HTMLTextAreaElement>(null);
  const articleImageInput = useRef<HTMLInputElement>(null);
  const catalogBackupInput = useRef<HTMLInputElement>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const [newModeName, setNewModeName] = useState('');
  const [newModeStrategy, setNewModeStrategy] = useState<'points' | 'winner'>('points');
  const [newModeDirection, setNewModeDirection] = useState<'highest' | 'lowest'>('highest');
  const [newVariation, setNewVariation] = useState('');
  const categoryList = useMemo(() => Object.values(props.categories), [props.categories]);
  const selected = props.games.find((game) => game.slug === selectedGame);
  const modes = selected?.scorekeeperModes?.length ? selected.scorekeeperModes : [
    { id: 'points', name: 'Points game', strategy: 'points' as const, direction: 'highest' as const },
    { id: 'winner', name: 'Who won?', strategy: 'winner' as const },
  ];
  const exportBackup = async () => {
    setBackupBusy(true); setBackupError(''); setBackupMessage('');
    try {
      const backup = await exportCatalogBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'games-io-catalog-backup.json'; anchor.click(); URL.revokeObjectURL(url);
      setBackupMessage('Catalog backup downloaded.');
    } catch { setBackupError('Catalog backup could not be exported.'); }
    finally { setBackupBusy(false); }
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    setBackupBusy(true); setBackupError(''); setBackupMessage('');
    try {
      const backup = JSON.parse(await file.text()) as CatalogBackup;
      if (backup.schemaVersion !== 1 || !backup.catalog || !Array.isArray(backup.catalog.games)) throw new Error('Invalid catalog backup');
      if (!window.confirm('Restore this catalog backup? It replaces the current catalog.')) return;
      await restoreCatalogBackup(backup);
      setBackupMessage('Catalog restored. Reloading the guide…');
      window.setTimeout(() => window.location.reload(), 700);
    } catch { setBackupError('This file is not a valid games.io catalog backup.'); }
    finally { setBackupBusy(false); if (catalogBackupInput.current) catalogBackupInput.current.value = ''; }
  };
  const saveMode = () => {
    if (!selected || !newModeName.trim()) return;
    const id = newModeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!id || modes.some((mode) => mode.id === id)) { setBackupError('Choose a distinct scorekeeper name.'); return; }
    const mode: ScorekeeperMode = newModeStrategy === 'points'
      ? { id, name: newModeName.trim(), strategy: 'points', direction: newModeDirection }
      : { id, name: newModeName.trim(), strategy: 'winner' };
    props.onUpdateGame(selected.slug, { scorekeeperModes: [...modes, mode] });
    setNewModeName(''); setBackupError('');
  };
  const saveVariation = () => {
    if (!selected || !newVariation.trim()) return;
    if ((selected.variations || []).some((item) => item.toLowerCase() === newVariation.trim().toLowerCase())) return;
    props.onUpdateGame(selected.slug, { variations: [...(selected.variations || []), newVariation.trim()] });
    setNewVariation('');
  };

  const unlock = async () => {
    try {
      await props.onUnlock(password);
      setPasswordError('');
    } catch {
      setPasswordError('That password does not match.');
    }
  };
  const addCategory = () => {
    if (!categoryName.trim()) return;
    props.onAddCategory({ name: categoryName, description: categoryDescription || 'A new shelf for good games.', color: categoryColor, children: [], parentSlug: categoryParent || undefined, primary: !categoryParent });
    setCategoryName(''); setCategoryDescription('');
  };
  const addGame = () => {
    if (!newGame.slug.trim() || !newGame.title.trim()) return;
    props.onAddGame({ ...newGame, slug: newGame.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'), categorySlugs: newGame.categorySlugs.length ? newGame.categorySlugs : categoryList.slice(0, 1).map((item) => item.slug) });
    setNewGame(blankGame);
  };
  const addInventory = async () => {
    if (!selected || !inventoryName.trim()) return;
    setUploading(true);
    try {
      const imagePath = inventoryFile ? await props.onUploadImage(inventoryFile) : undefined;
      props.onAddInventory(selected.slug, { id: `${selected.slug}-${Date.now()}`, name: inventoryName.trim(), description: inventoryDescription.trim() || 'Table item', imagePath });
      setInventoryName(''); setInventoryDescription(''); setInventoryImage(''); setInventoryFile(undefined);
    } catch {
      setPasswordError('The image could not be uploaded. Try again.');
    } finally {
      setUploading(false);
    }
    if (imageInput.current) imageInput.current.value = '';
  };
  const readImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setInventoryImage(typeof reader.result === 'string' ? reader.result : '');
    setInventoryFile(file);
    reader.readAsDataURL(file);
  };
  const updateArticle = (next: string) => {
    if (selected) props.onUpdateGame(selected.slug, { articleMarkdown: next });
  };
  const formatArticle = (before: string, after = before, linePrefix = '') => {
    const field = articleInput.current;
    if (!selected || !field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const value = selected.articleMarkdown || '';
    const selectedText = value.slice(start, end) || 'text';
    const next = `${value.slice(0, start)}${linePrefix}${before}${selectedText}${after}${value.slice(end)}`;
    updateArticle(next);
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + linePrefix.length + before.length, start + linePrefix.length + before.length + selectedText.length); });
  };
  const uploadArticleImage = async (file?: File) => {
    if (!file || !selected) return;
    setUploading(true); setArticleError('');
    try {
      const path = await props.onUploadImage(file);
      const field = articleInput.current;
      const offset = field?.selectionStart ?? (selected.articleMarkdown || '').length;
      const insertion = `![${file.name.replace(/\.[^.]+$/, '')}](/api/storage${path})`;
      const value = selected.articleMarkdown || '';
      updateArticle(`${value.slice(0, offset)}${value ? '\n\n' : ''}${insertion}${value.slice(offset)}`);
    } catch { setArticleError('The article image could not be uploaded. Try again.'); }
    finally { setUploading(false); if (articleImageInput.current) articleImageInput.current.value = ''; }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#090a0e]/75 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Admin panel">
      <div className="h-full w-full max-w-[700px] overflow-y-auto border-l border-white/[0.1] bg-[#12131a] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-[#12131a]/95 px-5 py-5 backdrop-blur sm:px-8">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f9be4b]">Local prototype</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.05em]">Admin field desk</h2></div>
          <button type="button" onClick={props.onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-[#a2a2ae] hover:text-[#f7f0e4]" aria-label="Close admin panel" data-testid="button-close-admin"><X size={18} /></button>
        </div>
        {!props.unlocked ? (
          <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
            <div className="w-full max-w-sm rounded-2xl border border-white/[0.09] bg-[#171821] p-6 text-center">
              <LockKeyhole className="mx-auto text-[#f9be4b]" size={30} />
              <h3 className="mt-5 text-xl font-semibold">Unlock the field desk</h3>
              <p className="mt-2 text-sm leading-6 text-[#898997]">Sign-in and a server-verified admin password are required before anything can be changed.</p>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && unlock()} placeholder="Admin password" className="mt-6 h-11 w-full rounded-xl border border-white/10 bg-[#12131a] px-3 text-sm text-[#f7f0e4] outline-none focus:border-[#f9be4b]/60" aria-label="Admin password" data-testid="input-admin-password" />
              {passwordError && <p className="mt-2 text-left text-xs text-[#ff9b90]">{passwordError}</p>}
              <button type="button" onClick={unlock} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f9be4b] text-sm font-bold text-[#171821] hover:bg-[#ffd47e]" data-testid="button-unlock-admin"><LockKeyhole size={15} /> Unlock locally</button>
            </div>
          </div>
        ) : (
          <div className="space-y-10 px-5 py-7 sm:px-8">
             <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#42d1b1]/25 bg-[#42d1b1]/[0.07] px-4 py-3 text-xs text-[#b7eadf]"><Check size={15} /><span>Admin session active</span><span className="ml-auto" role="status" data-testid="status-catalog-save">{props.catalogSaveState === 'saving' ? 'Saving to Replit Database…' : props.catalogSaveState === 'error' ? 'Save failed' : 'Saved to Replit Database'}</span>{props.catalogSaveState === 'error' && <button type="button" onClick={props.onRetryCatalogSave} className="rounded-lg border border-[#ff9b90]/30 px-2 py-1 font-semibold text-[#ff9b90]" data-testid="button-retry-catalog-save">Retry save</button>}<span className="rounded-full bg-[#42d1b1]/20 px-2 py-1 font-mono text-[10px] text-[#42d1b1]">ADMIN</span></div>
             <section className="rounded-2xl border border-white/[0.08] bg-[#171821]/60 p-4"><SectionLabel>Catalog backup</SectionLabel><p className="mb-3 text-xs leading-5 text-[#898997]">Export or restore the catalog, including game mode and variation configuration.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={backupBusy} onClick={() => void exportBackup()} className="admin-action disabled:opacity-50" data-testid="button-export-catalog"><Download size={15} /> Export catalog</button><button type="button" disabled={backupBusy} onClick={() => catalogBackupInput.current?.click()} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-[#c2c0c0] hover:border-[#42d1b1]/50 hover:text-[#42d1b1] disabled:opacity-50" data-testid="button-import-catalog"><Upload size={15} /> Import catalog</button><input ref={catalogBackupInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importBackup(event.target.files?.[0])} aria-label="Import catalog backup" /></div>{backupMessage && <p className="mt-3 text-xs text-[#42d1b1]" role="status" data-testid="status-catalog-backup">{backupMessage}</p>}{backupError && <p className="mt-3 text-xs text-[#ff9b90]" role="alert" data-testid="status-catalog-backup-error">{backupError}</p>}</section>
            <section><SectionLabel>Add a category</SectionLabel><div className="grid gap-2 sm:grid-cols-2"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Category name" className="admin-input" data-testid="input-category-name" /><input value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} placeholder="Short description" className="admin-input" data-testid="input-category-description" /><input type="color" value={categoryColor} onChange={(event) => setCategoryColor(event.target.value)} className="admin-input h-11 p-1" aria-label="Category color" data-testid="input-category-color" /><select value={categoryParent} onChange={(event) => setCategoryParent(event.target.value)} className="admin-input" aria-label="Parent category" data-testid="select-category-parent"><option value="">Primary shelf</option>{categoryList.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></div><button type="button" onClick={addCategory} className="admin-action mt-3" data-testid="button-add-category"><Plus size={15} /> Add category</button><div className="mt-4 space-y-2">{categoryList.map((category) => <div key={category.slug} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#171821] px-3 py-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} /><span className="min-w-0 flex-1 truncate text-sm">{category.name}</span><button type="button" onClick={() => props.onRemoveCategory(category.slug)} className="text-[#777984] hover:text-[#ff9b90]" aria-label={`Remove ${category.name}`} data-testid={`button-remove-category-${category.slug}`}><Trash2 size={14} /></button></div>)}</div></section>
            <section><SectionLabel>Add a game article</SectionLabel><div className="grid gap-2 sm:grid-cols-2"><input value={newGame.title} onChange={(event) => setNewGame({ ...newGame, title: event.target.value })} placeholder="Title" className="admin-input" data-testid="input-game-title" /><input value={newGame.slug} onChange={(event) => setNewGame({ ...newGame, slug: event.target.value })} placeholder="Slug" className="admin-input" data-testid="input-game-slug" /><input value={newGame.description} onChange={(event) => setNewGame({ ...newGame, description: event.target.value })} placeholder="Description" className="admin-input sm:col-span-2" data-testid="input-game-description" /><input value={newGame.players} onChange={(event) => setNewGame({ ...newGame, players: event.target.value })} placeholder="Players" className="admin-input" data-testid="input-game-players" /><input value={newGame.duration} onChange={(event) => setNewGame({ ...newGame, duration: event.target.value })} placeholder="Play time" className="admin-input" data-testid="input-game-duration" /><input value={newGame.setup} onChange={(event) => setNewGame({ ...newGame, setup: event.target.value })} placeholder="Setup time" className="admin-input" data-testid="input-game-setup" /><input value={newGame.age} onChange={(event) => setNewGame({ ...newGame, age: event.target.value })} placeholder="Age recommendation" className="admin-input" data-testid="input-game-age" /><textarea value={newGame.objective} onChange={(event) => setNewGame({ ...newGame, objective: event.target.value })} placeholder="Objective" className="admin-input min-h-20 sm:col-span-2" data-testid="input-game-objective" /><textarea value={newGame.rules.join('\n')} onChange={(event) => setNewGame({ ...newGame, rules: event.target.value.split('\n').filter(Boolean) })} placeholder="Rules, one per line" className="admin-input min-h-24 sm:col-span-2" data-testid="input-game-rules" /><textarea value={newGame.equipment.join('\n')} onChange={(event) => setNewGame({ ...newGame, equipment: event.target.value.split('\n').filter(Boolean) })} placeholder="Equipment, one per line" className="admin-input min-h-20 sm:col-span-2" data-testid="input-game-equipment" /></div><div className="mt-3 flex flex-wrap gap-2">{categoryList.map((category) => <button type="button" key={category.slug} onClick={() => setNewGame({ ...newGame, categorySlugs: newGame.categorySlugs.includes(category.slug) ? newGame.categorySlugs.filter((item) => item !== category.slug) : [...newGame.categorySlugs, category.slug] })} className={`rounded-full border px-3 py-1.5 text-xs ${newGame.categorySlugs.includes(category.slug) ? 'border-[#f9be4b] bg-[#f9be4b]/10 text-[#f9be4b]' : 'border-white/10 text-[#898997]'}`}>{category.name}</button>)}</div><button type="button" onClick={addGame} className="admin-action mt-3" data-testid="button-add-game"><Plus size={15} /> Add article</button></section>
            <section><SectionLabel>Edit game article</SectionLabel><select value={selectedGame} onChange={(event) => setSelectedGame(event.target.value)} className="admin-input w-full" aria-label="Select game to edit" data-testid="select-edit-game">{props.games.map((game) => <option key={game.slug} value={game.slug}>{game.title}</option>)}</select>{selected && <div className="mt-3 space-y-2"><input value={selected.title} onChange={(event) => props.onUpdateGame(selected.slug, { title: event.target.value })} className="admin-input w-full" aria-label="Edit game title" data-testid="input-edit-game-title" /><textarea value={selected.description} onChange={(event) => props.onUpdateGame(selected.slug, { description: event.target.value })} className="admin-input min-h-20 w-full" aria-label="Edit game description" data-testid="input-edit-game-description" /><div className="grid gap-2 sm:grid-cols-2"><input value={selected.setup} onChange={(event) => props.onUpdateGame(selected.slug, { setup: event.target.value })} className="admin-input" aria-label="Edit setup time" placeholder="Setup time" data-testid="input-edit-game-setup" /><input value={selected.age} onChange={(event) => props.onUpdateGame(selected.slug, { age: event.target.value })} className="admin-input" aria-label="Edit age recommendation" placeholder="Age recommendation" data-testid="input-edit-game-age" /></div><textarea value={selected.objective} onChange={(event) => props.onUpdateGame(selected.slug, { objective: event.target.value })} className="admin-input min-h-20 w-full" aria-label="Edit game objective" data-testid="input-edit-game-objective" /><textarea value={selected.rules.join('\n')} onChange={(event) => props.onUpdateGame(selected.slug, { rules: event.target.value.split('\n').filter(Boolean) })} className="admin-input min-h-28 w-full" aria-label="Edit game rules" data-testid="input-edit-game-rules" /><textarea value={selected.equipment.join('\n')} onChange={(event) => props.onUpdateGame(selected.slug, { equipment: event.target.value.split('\n').filter(Boolean) })} className="admin-input min-h-20 w-full" aria-label="Edit game equipment" data-testid="input-edit-game-equipment" />
               <section className="rounded-2xl border border-[#42d1b1]/20 bg-[#12201e]/35 p-4" data-testid="section-scorekeeper-config"><SectionLabel>Scorekeeper modes · {selected.title}</SectionLabel><p className="mb-4 text-xs leading-5 text-[#898997]">Each mode uses the shared points or winner strategy. Points modes also choose which direction wins.</p><div className="space-y-2">{modes.map((mode) => <div key={mode.id} className="grid gap-2 rounded-xl border border-white/[0.08] bg-[#12131a] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#777984]">{mode.id}</p><input value={mode.name} onChange={(event) => props.onUpdateGame(selected.slug, { scorekeeperModes: modes.map((item) => item.id === mode.id ? { ...item, name: event.target.value } : item) })} maxLength={48} className="admin-input mt-1 w-full" aria-label={`Mode name ${mode.name}`} data-testid={`input-scorekeeper-mode-name-${mode.id}`} /></div><select value={mode.strategy} onChange={(event) => { const strategy = event.target.value as 'points' | 'winner'; props.onUpdateGame(selected.slug, { scorekeeperModes: modes.map((item) => item.id === mode.id ? (strategy === 'points' ? { ...item, strategy, direction: item.direction || 'highest' } : { id: item.id, name: item.name, strategy }) : item) }); }} className="admin-input" aria-label={`Strategy for ${mode.name}`} data-testid={`select-scorekeeper-mode-strategy-${mode.id}`}><option value="points">Points</option><option value="winner">Winner only</option></select><div className="flex items-center gap-2">{mode.strategy === 'points' && <select value={mode.direction || 'highest'} onChange={(event) => props.onUpdateGame(selected.slug, { scorekeeperModes: modes.map((item) => item.id === mode.id ? { ...item, direction: event.target.value as 'highest' | 'lowest' } : item) })} className="admin-input" aria-label={`Winning direction for ${mode.name}`} data-testid={`select-scorekeeper-mode-direction-${mode.id}`}><option value="highest">Highest wins</option><option value="lowest">Lowest wins</option></select>}<button type="button" disabled={modes.length <= 1} onClick={() => props.onUpdateGame(selected.slug, { scorekeeperModes: modes.filter((item) => item.id !== mode.id) })} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-[#898997] hover:text-[#ff9b90] disabled:opacity-30" aria-label={`Remove ${mode.name}`} data-testid={`button-remove-scorekeeper-mode-${mode.id}`}><Trash2 size={14} /></button></div></div>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input value={newModeName} onChange={(event) => setNewModeName(event.target.value)} maxLength={48} placeholder="Name a mode" className="admin-input" aria-label="New scorekeeper mode name" data-testid="input-new-scorekeeper-mode" /><select value={newModeStrategy} onChange={(event) => setNewModeStrategy(event.target.value as 'points' | 'winner')} className="admin-input" aria-label="New mode strategy" data-testid="select-new-scorekeeper-strategy"><option value="points">Points</option><option value="winner">Winner only</option></select><div className="flex gap-2">{newModeStrategy === 'points' && <select value={newModeDirection} onChange={(event) => setNewModeDirection(event.target.value as 'highest' | 'lowest')} className="admin-input" aria-label="New points mode direction" data-testid="select-new-scorekeeper-direction"><option value="highest">Highest</option><option value="lowest">Lowest</option></select>}<button type="button" onClick={saveMode} disabled={!newModeName.trim()} className="admin-action disabled:opacity-40" data-testid="button-add-scorekeeper-mode"><Plus size={14} /> Add</button></div></div><div className="mt-5 border-t border-white/[0.08] pt-4"><SectionLabel>Variation paths</SectionLabel><div className="flex flex-wrap gap-2">{(selected.variations || []).map((variation) => <span key={variation} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#12131a] px-3 py-2 text-xs text-[#c2c0c0]">{variation}<button type="button" onClick={() => props.onUpdateGame(selected.slug, { variations: (selected.variations || []).filter((item) => item !== variation) })} aria-label={`Remove variation ${variation}`} className="text-[#777984] hover:text-[#ff9b90]" data-testid={`button-remove-variation-${variation}`}><X size={13} /></button></span>)}</div><div className="mt-3 flex gap-2"><input value={newVariation} onChange={(event) => setNewVariation(event.target.value)} maxLength={80} placeholder="Add a variation path" className="admin-input min-w-0 flex-1" aria-label="New game variation" data-testid="input-new-variation" /><button type="button" onClick={saveVariation} disabled={!newVariation.trim()} className="admin-action disabled:opacity-40" data-testid="button-add-variation"><Plus size={14} /> Add variation</button></div></div></section>
               <div className="rounded-2xl border border-white/10 bg-[#12131a] p-3" data-testid="editor-article-markdown"><div className="mb-2 flex flex-wrap gap-1.5" role="toolbar" aria-label="Article formatting">
                <button type="button" onClick={() => formatArticle('## ', '', '')} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#a2a2ae] hover:text-[#f9be4b]" aria-label="Heading" title="Heading" data-testid="button-article-heading"><Heading2 size={16} /></button>
                <button type="button" onClick={() => formatArticle('**')} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#a2a2ae] hover:text-[#f9be4b]" aria-label="Bold" title="Bold" data-testid="button-article-bold"><Bold size={15} /></button>
                <button type="button" onClick={() => formatArticle('*')} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#a2a2ae] hover:text-[#f9be4b]" aria-label="Italic" title="Italic" data-testid="button-article-italic"><Italic size={15} /></button>
                <button type="button" onClick={() => formatArticle('++')} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#a2a2ae] hover:text-[#f9be4b]" aria-label="Underline" title="Underline" data-testid="button-article-underline"><Underline size={15} /></button>
                <button type="button" onClick={() => formatArticle('', '', '- ')} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#a2a2ae] hover:text-[#f9be4b]" aria-label="Bulleted list" title="Bulleted list" data-testid="button-article-bullets"><List size={16} /></button>
                <button type="button" onClick={() => formatArticle('', '', '1. ')} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#a2a2ae] hover:text-[#f9be4b]" aria-label="Numbered list" title="Numbered list" data-testid="button-article-numbered"><ListOrdered size={16} /></button>
                <button type="button" onClick={() => articleImageInput.current?.click()} disabled={uploading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-2.5 text-xs font-semibold text-[#a2a2ae] hover:text-[#f9be4b] disabled:opacity-50" data-testid="button-article-image"><ImagePlus size={15} /> {uploading ? 'Uploading…' : 'Insert image'}</button>
                <input ref={articleImageInput} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadArticleImage(event.target.files?.[0])} aria-label="Upload article image" data-testid="input-article-image" />
              </div>
              <textarea ref={articleInput} value={selected.articleMarkdown || ''} onChange={(event) => updateArticle(event.target.value)} placeholder="Add a field note…&#10;&#10;## A useful heading&#10;Write concise advice for the table." className="admin-input min-h-48 w-full resize-y font-mono text-xs leading-6" aria-label="Article markdown" data-testid="input-article-markdown" />
              {articleError && <p role="alert" className="mt-2 text-xs text-[#ff9b90]" data-testid="status-article-upload-error">{articleError}</p>}
              <p className="mt-2 text-[11px] text-[#777984]" data-testid="text-article-markdown-help">Markdown preview is rendered as safe text. Images are uploaded to App Storage.</p></div>
              <button type="button" onClick={() => props.onRemoveGame(selected.slug)} className="flex items-center gap-2 text-xs font-semibold text-[#ff9b90] hover:text-[#ffb5ac]" data-testid="button-remove-game"><Trash2 size={14} /> Remove article</button></div>}</section>
            <section><SectionLabel>Add inventory to {selected?.title || 'a game'}</SectionLabel><div className="grid gap-2 sm:grid-cols-[1fr_1fr]"><input value={inventoryName} onChange={(event) => setInventoryName(event.target.value)} placeholder="Item name" className="admin-input" data-testid="input-inventory-name" /><input value={inventoryDescription} onChange={(event) => setInventoryDescription(event.target.value)} placeholder="Type or description" className="admin-input" data-testid="input-inventory-description" /></div><input ref={imageInput} type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0])} className="mt-2 block w-full text-xs text-[#898997] file:mr-3 file:rounded-lg file:border-0 file:bg-[#f9be4b] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#171821]" aria-label="Upload inventory image" data-testid="input-inventory-image" />{inventoryImage && <div className="mt-3 flex items-center gap-3 text-xs text-[#42d1b1]"><img src={inventoryImage} alt="Inventory preview" className="h-12 w-12 rounded-lg object-cover" /><span>Image ready to upload</span></div>}<button type="button" onClick={() => void addInventory()} disabled={!selected || uploading} className="admin-action mt-3 disabled:opacity-40" data-testid="button-add-inventory"><ImagePlus size={15} /> {uploading ? 'Uploading…' : 'Add item'}</button><div className="mt-4 space-y-2">{(selected ? props.inventory[selected.slug] || [] : []).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#171821] px-3 py-2"><div className="h-9 w-9 overflow-hidden rounded-lg bg-[#24232a]">{(item.imagePath || item.imageDataUrl) && <img src={item.imagePath ? `/api/storage${item.imagePath}` : item.imageDataUrl} alt="" className="h-full w-full object-cover" />}</div><span className="min-w-0 flex-1 truncate text-sm">{item.name}</span><button type="button" onClick={() => selected && props.onRemoveInventory(selected.slug, item.id)} className="text-[#777984] hover:text-[#ff9b90]" aria-label={`Remove ${item.name}`} data-testid={`button-admin-remove-inventory-${item.id}`}><Trash2 size={14} /></button></div>)}</div></section>
             <button type="button" onClick={() => { if (window.confirm('This permanently replaces the saved catalog in the current environment with starter data. Profiles, favorites, saved games, and uploaded images will remain. Continue?')) props.onReset(); }} className="flex items-center gap-2 text-xs font-semibold text-[#777984] hover:text-[#f9be4b]" data-testid="button-reset-catalog"><RotateCcw size={14} /> Reset starter catalog</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">{children}</p>;
}