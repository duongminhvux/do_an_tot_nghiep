type Ipa = { us?: string; uk?: string };
const cached = new Map<string, { until: number; ipa: Ipa }>();
function plain(html: string) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, number) => {
      const code =
        number[0].toLowerCase() === 'x'
          ? parseInt(number.slice(1), 16)
          : Number(number);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}
export function parseEnglishIpa(html: string): Ipa {
  const english = /<h2\b[^>]*\bid=["']English["'][^>]*>/i.exec(html);
  if (!english) return {};
  const remainder = html.slice(english.index + english[0].length),
    next = /<h2\b/i.exec(remainder);
  const section = next ? remainder.slice(0, next.index) : remainder;
  const best: {
    us?: { score: number; value: string };
    uk?: { score: number; value: string };
  } = {};
  for (const heading of section.matchAll(
    /<h[3-6]\b[^>]*\bid=["']Pronunciation(?:_\d+)?["'][^>]*>/gi,
  )) {
    const rest = section.slice(heading.index! + heading[0].length),
      end = /<h[2-6]\b/i.exec(rest),
      block = end ? rest.slice(0, end.index) : rest;
    for (const span of block.matchAll(
      /<span\b[^>]*\bclass=["'][^"']*\bIPA\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    )) {
      const value = plain(span[1]);
      if (!/^[/\[][^/\[\]]{1,180}[/\]]$/.test(value)) continue;
      const start = block.lastIndexOf('<li', span.index),
        context = plain(block.slice(Math.max(0, start), span.index))
          .replace(/\bIPA\s*\(key\)\s*:?\s*/gi, '')
          .slice(-1600);
      if (
        /\b(obsolete|archaic|unstressed|weak form|reduced|rare)\b/i.test(
          context,
        )
      )
        continue;
      const us =
        /\b(US|USA|United States|General American|American English)\b/i.test(
          context,
        );
      const uk =
        /\b(UK|British|Received Pronunciation|RP|Southern England|Standard Southern British)\b/i.test(
          context,
        );
      const genericContext = context.replace(
        /\((?:stressed|strong|careful) form\)/gi,
        '',
      );
      const general =
        !us &&
        !uk &&
        !/\b(Australia|Australian|Canada|Canadian|Zealand|Scotland|Scottish|Ireland|Irish|Wales|Welsh|regional)\b/i.test(
          context,
        ) &&
        !genericContext.includes('(');
      for (const accent of ['us', 'uk'] as const) {
        if (!(accent === 'us' ? us : uk) && !general) continue;
        const preferred =
          accent === 'us'
            ? /General American/i.test(context)
            : /Received Pronunciation|\bRP\b/i.test(context);
        const score = preferred ? 100 : general ? 20 : 80;
        if (!best[accent] || score > best[accent]!.score)
          best[accent] = { score, value };
      }
    }
  }
  return {
    ...(best.us ? { us: best.us.value } : {}),
    ...(best.uk ? { uk: best.uk.value } : {}),
  };
}
export async function wiktionaryIpa(word: string): Promise<Ipa> {
  if (!/^[a-z][a-z' -]{0,99}$/.test(word)) return {};
  const hit = cached.get(word);
  if (hit && hit.until > Date.now()) return hit.ipa;
  try {
    const response = await fetch(
      'https://en.wiktionary.org/w/api.php?' +
        new URLSearchParams({
          action: 'parse',
          page: word,
          prop: 'text',
          format: 'json',
          redirects: '1',
        }),
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
        redirect: 'error',
      },
    );
    if (!response.ok) throw new Error('IPA source unavailable');
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error('IPA response too large');
    const data = JSON.parse(body),
      html = data.parse?.text?.['*'];
    const ipa = typeof html === 'string' ? parseEnglishIpa(html) : {};
    const capital = word[0].toUpperCase() + word.slice(1);
    if (
      (!ipa.us || !ipa.uk) &&
      typeof html === 'string' &&
      html.includes(`/wiki/${encodeURIComponent(capital)}#English`)
    ) {
      try {
        const alternative = await fetch(
          'https://en.wiktionary.org/w/api.php?' +
            new URLSearchParams({
              action: 'parse',
              page: capital,
              prop: 'text',
              format: 'json',
              redirects: '1',
            }),
          {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(6000),
            redirect: 'error',
          },
        );
        if (alternative.ok) {
          const body = await alternative.text();
          if (body.length <= 2_000_000) {
            const extraHtml = JSON.parse(body).parse?.text?.['*'];
            if (typeof extraHtml === 'string') {
              const extra = parseEnglishIpa(extraHtml);
              if (!ipa.us && extra.us) ipa.us = extra.us;
              if (!ipa.uk && extra.uk) ipa.uk = extra.uk;
            }
          }
        }
      } catch {}
    }
    if (cached.size >= 1000) cached.delete(cached.keys().next().value!);
    cached.set(word, {
      until: Date.now() + (ipa.us && ipa.uk ? 86_400_000 : 300_000),
      ipa,
    });
    return ipa;
  } catch {
    return {};
  }
}
