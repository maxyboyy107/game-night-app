import { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Link } from 'wouter';
import { saveGameNightHouseRules } from '@workspace/api-client-react';
import type { GameNightDetail } from '@workspace/api-client-react';

export function ArticleHouseRules({
  gameSlug,
  gameNight,
  onSaved,
}: {
  gameSlug: string;
  gameNight?: GameNightDetail;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [rulesText, setRulesText] = useState('');
  const [variation, setVariation] = useState('');
  const [rulesVersion, setRulesVersion] = useState('1.0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saved = gameNight?.houseRules.find((rule) => rule.gameSlug === gameSlug);
  const isHost = gameNight?.night.role === 'host';

  useEffect(() => {
    setRulesText(saved?.rulesText || '');
    setVariation(saved?.variation || '');
    setRulesVersion(saved?.rulesVersion || '1.0');
  }, [saved?.rulesText, saved?.variation, saved?.rulesVersion, gameSlug]);

  const save = async () => {
    if (!gameNight) return;
    setBusy(true);
    setError('');
    try {
      await saveGameNightHouseRules(gameNight.night.id, gameSlug, {
        rulesText: rulesText.trim() || null,
        variation: variation.trim() || null,
        rulesVersion: rulesVersion.trim() || null,
      });
      await onSaved();
      setEditing(false);
    } catch {
      setError('House rules could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  if (!gameNight) return <div className="no-print mt-6 rounded-xl border border-white/[0.08] bg-[#171821]/60 px-4 py-3 text-xs text-[#898997]">Choose a Game Night to see your family rules and start a saved scorekeeper. <Link href="/game-nights" className="ml-1 font-semibold text-[#f9be4b]">Open Game Nights</Link></div>;

  const hasHouseRules = Boolean(saved?.rulesText || saved?.variation);
  return <>
    {hasHouseRules && <div className="mt-5 rounded-xl border border-[#42d1b1]/20 bg-[#12201e]/45 p-4" data-testid="badge-game-house-rules"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#42d1b1]">Family house rules · {gameNight.night.name}</p>{saved?.variation && <p className="mt-1 text-sm font-semibold text-[#f7f0e4]">Variation · {saved.variation}</p>}{saved?.rulesText && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#c2c0c0]">{saved.rulesText}</p>}</div>}
    {isHost && <div className="no-print mt-3">
      {!editing ? <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae] hover:border-[#42d1b1]/40 hover:text-[#42d1b1]" data-testid="button-edit-article-rules"><Pencil size={13} /> {hasHouseRules ? 'Edit family rules' : 'Add family rules'}</button> : <div className="rounded-xl border border-white/[0.09] bg-[#12131a] p-4">
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Rules version<input value={rulesVersion} onChange={(event) => setRulesVersion(event.target.value)} maxLength={24} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#171821] px-3 text-sm normal-case tracking-normal text-[#f7f0e4]" /></label><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">Variation<input value={variation} onChange={(event) => setVariation(event.target.value)} maxLength={120} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#171821] px-3 text-sm normal-case tracking-normal text-[#f7f0e4]" /></label></div>
        <label className="mt-3 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#898997]">House rules<textarea value={rulesText} onChange={(event) => setRulesText(event.target.value)} maxLength={6000} className="mt-2 min-h-24 w-full resize-y rounded-lg border border-white/10 bg-[#171821] px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-[#f7f0e4]" /></label>
        {error && <p role="alert" className="mt-2 text-xs text-[#ff9b90]">{error}</p>}
        <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-[#f9be4b] px-3 py-2 text-xs font-bold text-[#171821] disabled:opacity-50"><Check size={13} /> {busy ? 'Saving…' : 'Save rules'}</button><button type="button" onClick={() => { setEditing(false); setError(''); }} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#a2a2ae]"><X size={13} /> Cancel</button></div>
      </div>}
    </div>}
    <div className="mt-8 flex items-center justify-between border-t border-white/[0.09] pt-4 text-[11px] text-[#777984]" data-testid="footer-article-rules-version"><span>{gameNight.night.name} · Rules version {saved?.rulesVersion || rulesVersion || '1.0'}</span>{saved?.updatedAt && <span>Updated {new Date(saved.updatedAt).toLocaleDateString()}</span>}</div>
  </>;
}
