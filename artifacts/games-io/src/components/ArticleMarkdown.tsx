import { useMemo, type ReactNode } from 'react';

function safeImageSource(source: string) {
  const trimmed = source.trim();
  if (/^\/api\/storage\/objects\/uploads\/[a-f0-9-]{36}$/i.test(trimmed)) return trimmed;
  return '';
}

export function ArticleMarkdown({ markdown }: { markdown?: string }) {
  const blocks = useMemo(() => (markdown || '').split(/\n{2,}/).map((block) => block.trim()).filter(Boolean), [markdown]);
  if (!blocks.length) return null;
  return <section className="mt-12 border-t border-white/[0.09] pt-10" data-testid="section-article-markdown">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#777984]">From the field desk</p>
    <div className="article-copy mt-5 space-y-4" data-testid="content-article-markdown">
      {blocks.map((block, index) => {
        const heading = /^(#{1,3})\s+(.+)$/.exec(block);
        const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(block);
        if (heading) {
          const text = heading[2];
          const Tag = heading[1].length === 1 ? 'h2' : heading[1].length === 2 ? 'h3' : 'h4';
          return <Tag key={index} className="pt-3 text-2xl font-semibold tracking-[-0.05em]" data-testid={`article-heading-${index}`}>{text}</Tag>;
        }
        if (image) {
          const src = safeImageSource(image[2]);
          return src ? <figure key={index} className="overflow-hidden rounded-2xl border border-white/10 bg-[#171821]" data-testid={`article-image-${index}`}><img src={src} alt={image[1]} loading="lazy" className="max-h-[480px] w-full object-contain" /><figcaption className="px-4 py-3 text-xs text-[#898997]">{image[1]}</figcaption></figure> : null;
        }
        const ordered = block.split('\n').every((line) => /^\s*\d+\.\s+/.test(line));
        const unordered = block.split('\n').every((line) => /^\s*[-*]\s+/.test(line));
        if (ordered || unordered) {
          const List = ordered ? 'ol' : 'ul';
          return <List key={index} className={`space-y-2 pl-6 text-[15px] leading-7 text-[#c2c0c0] ${ordered ? 'list-decimal' : 'list-disc'}`} data-testid={`article-list-${index}`}>
            {block.split('\n').map((line, itemIndex) => <li key={itemIndex}>{inlineMarkup(line.replace(/^\s*(?:\d+\.|[-*])\s+/, ''), `${index}-${itemIndex}`)}</li>)}
          </List>;
        }
        return <p key={index} className="max-w-[760px] text-[15px] leading-7 text-[#c2c0c0]" data-testid={`article-paragraph-${index}`}>{block.split('\n').map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{inlineMarkup(line, `${index}-${lineIndex}`)}</span>)}</p>;
      })}
    </div>
  </section>;
}

function inlineMarkup(text: string, key: string): ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|__[^_]+__|\+\+[^+]+\+\+)/g);
  return tokens.map((token, index) => {
    if (token.startsWith('++') && token.endsWith('++')) return <u key={`${key}-${index}`}>{token.slice(2, -2)}</u>;
    if (token.startsWith('**') || token.startsWith('__')) return <strong key={`${key}-${index}`}>{token.slice(2, -2)}</strong>;
    if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) return <em key={`${key}-${index}`}>{token.slice(1, -1)}</em>;
    return token;
  });
}