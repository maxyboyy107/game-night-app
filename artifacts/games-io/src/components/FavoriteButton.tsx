import { Heart } from 'lucide-react';

export function FavoriteButton({ slug, favorited, signedIn, onToggle }: { slug: string; favorited: boolean; signedIn: boolean; onToggle: (slug: string, value: boolean) => void }) {
  return <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(slug, !favorited); }} className={`pressable inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${favorited ? 'border-[#f9be4b]/40 bg-[#f9be4b]/10 text-[#f9be4b]' : 'border-white/10 text-[#a2a2ae] hover:border-[#f9be4b]/40 hover:text-[#f9be4b]'}`} aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'} data-testid={`button-favorite-${slug}`} data-favorited={favorited}>
    <Heart size={15} fill={favorited ? 'currentColor' : 'none'} />{favorited ? 'Saved' : signedIn ? 'Save game' : 'Sign in to save'}
    {!signedIn && <span className="sr-only">Sign in required</span>}
  </button>;
}