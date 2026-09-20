import { PackageOpen, Trash2 } from 'lucide-react';
import type { Game } from '../data/games';
import type { InventoryItem } from '../data/catalog';

type InventoryBankProps = {
  game: Game;
  items: InventoryItem[];
  adminUnlocked: boolean;
  onRemove: (id: string) => void;
};

export function InventoryBank({ game, items, adminUnlocked, onRemove }: InventoryBankProps) {
  return (
    <section className="mt-12 border-t border-white/[0.09] pt-10" data-testid={`section-inventory-${game.slug}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">Inventory bank</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em]">What is on the table</h2>
        </div>
        <span className="rounded-full border border-[#42d1b1]/25 bg-[#42d1b1]/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#42d1b1]">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
      </div>
      {items.length ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="group relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#171821] p-2" data-testid={`card-inventory-${item.id}`}>
              <div className="aspect-[1.25] overflow-hidden rounded-xl bg-[#24232a]">
                {(item.imagePath || item.imageDataUrl) ? <img src={item.imagePath ? `/api/storage${item.imagePath}` : item.imageDataUrl} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-[#777984]"><PackageOpen size={28} /></div>}
              </div>
              <div className="px-2 pb-2 pt-3">
                <h3 className="truncate text-sm font-semibold text-[#f7f0e4]">{item.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#898997]">{item.description}</p>
              </div>
              {adminUnlocked && <button type="button" onClick={() => onRemove(item.id)} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg bg-[#171821]/90 text-[#f7f0e4] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 hover:text-[#ff8c82]" aria-label={`Remove ${item.name}`} data-testid={`button-remove-inventory-${item.id}`}><Trash2 size={14} /></button>}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
          <PackageOpen className="mx-auto text-[#42d1b1]" size={28} />
          <h3 className="mt-4 text-lg font-semibold">The bank is waiting</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#898997]">No cards, pieces, or equipment have been logged for this guide yet.</p>
        </div>
      )}
    </section>
  );
}