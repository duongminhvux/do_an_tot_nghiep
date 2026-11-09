import { ServiceUnavailableException } from '@nestjs/common';
import { wiktionaryIpa } from './wiktionary-ipa.js';

type DictionaryWord = {
  _id: string;
  word: string;
  slug: string;
  level: string;
  ipa: { us?: string; uk?: string };
  ipaDerivedFrom?: string;
  audio: { us?: string; uk?: string };
  audioSources?: { us?: string; uk?: string };
  parts: Array<{
    partOfSpeech: string;
    meanings: Array<{
      definition: string;
      translation: string[];
      examples: Array<{ en: string }>;
    }>;
  }>;
  sourceName: string;
  sourceUrl: string;
  licenseUrl?: string;
  translationSource?: string;
  saved: boolean;
};
const cache = new Map<
  string,
  { expires: number; value: DictionaryWord | null }
>();
const pending = new Map<string, Promise<DictionaryWord | null>>();
export function pluralIpa(ipa: string) {
  const match = /^([/\[])([^/\[\]]+)[/\]]$/.exec(ipa.trim());
  if (!match) return undefined;
  const stem = match[2],
    last = stem.replace(/[()ːˑ\u0300-\u036f.\s]/gu, '').slice(-1);
  const suffix = /[szʃʒ]/u.test(last)
    ? 'ɪz'
    : /[ptkfθ]/u.test(last)
      ? 's'
      : 'z';
  return `${match[1]}${stem}${suffix}${match[1] === '[' ? ']' : '/'}`;
}
function regularPluralLemma(word: string, entries: any[]) {
  if (
    !entries.some((e) =>
      e.meanings?.some((m: any) => m.partOfSpeech === 'noun'),
    )
  )
    return undefined;
  for (const entry of entries)
    for (const source of Array.isArray(entry.sourceUrls)
      ? entry.sourceUrls
      : []) {
      try {
        const url = new URL(source);
        if (
          url.hostname !== 'en.wiktionary.org' ||
          !url.pathname.startsWith('/wiki/')
        )
          continue;
        const lemma = decodeURIComponent(url.pathname.slice(6)).toLowerCase();
        if (
          !/^[a-z]{1,80}$/.test(lemma) ||
          [
            'house',
            'mouth',
            'bath',
            'youth',
            'path',
            'cloth',
            'truth',
            'sheath',
            'wreath',
            'oath',
          ].includes(lemma)
        )
          continue;
        if (
          (word === lemma + 's' && !/(s|x|z|ch|sh)$/.test(lemma)) ||
          (word === lemma + 'es' && /(s|x|z|ch|sh)$/.test(lemma)) ||
          (/[^aeiou]y$/.test(lemma) && word === lemma.slice(0, -1) + 'ies')
        )
          return lemma;
      } catch {}
    }
  return undefined;
}
const audioCache = new Map<string, string>();
export async function dictionaryPronunciation(input: string, accent: string) {
  if (!['us', 'uk'].includes(accent)) return { audio: '' };
  const word = await lookupDictionary(input),
    url = word?.audio[accent as 'us' | 'uk'];
  if (!url) return { audio: '' };
  const parsed = new URL(url);
  if (
    parsed.hostname !== 'api.dictionaryapi.dev' ||
    !parsed.pathname.startsWith('/media/pronunciations/en/')
  )
    return { audio: '' };
  const cached = audioCache.get(url);
  if (cached) return { audio: cached };
  try {
    let original = url;
    const source = word?.audioSources?.[accent as 'us' | 'uk'];
    if (source) {
      const reference = new URL(source),
        id = reference.searchParams.get('curid');
      if (
        reference.hostname === 'commons.wikimedia.org' &&
        id &&
        /^\d+$/.test(id)
      ) {
        const info = await json(
          'https://commons.wikimedia.org/w/api.php?' +
            new URLSearchParams({
              action: 'query',
              format: 'json',
              pageids: id,
              prop: 'imageinfo',
              iiprop: 'url',
            }),
        );
        const file = safeUrl(info?.query?.pages?.[id]?.imageinfo?.[0]?.url);
        if (
          file &&
          new URL(file).hostname === 'upload.wikimedia.org' &&
          new URL(file).pathname.startsWith('/wikipedia/commons/')
        )
          original = file;
      }
    }
    const response = await fetch(original, {
      signal: AbortSignal.timeout(6000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Audio unavailable');
    const rawMime = (response.headers.get('content-type') || '').split(';')[0];
    const mime = rawMime === 'application/ogg' ? 'audio/ogg' : rawMime;
    if (!['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav'].includes(mime))
      throw new Error('Invalid audio');
    const body = await response.arrayBuffer();
    if (body.byteLength > 2_000_000) throw new Error('Audio too large');
    const audio = `data:${mime};base64,${Buffer.from(body).toString('base64')}`;
    if (audioCache.size >= 100)
      audioCache.delete(audioCache.keys().next().value!);
    audioCache.set(url, audio);
    return { audio };
  } catch {
    throw new ServiceUnavailableException(
      'Không tải được phát âm. Hãy thử lại.',
    );
  }
}
const safeUrl = (value: unknown) => {
  try {
    const url = new URL(
      String(value).startsWith('//') ? 'https:' + value : String(value),
    );
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};
const text = (value: unknown, max = 1000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
async function json(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Dictionary upstream HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > 1_000_000) throw new Error('Dictionary response too large');
  return JSON.parse(body);
}
export function normalizeDictionaryTerm(input?: string) {
  const term = (input || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .trim()
    .replace(/^[^a-z]+|[^a-z]+$/g, '')
    .replace(/\s+/g, ' ');
  return term.length <= 100 && /^[a-z][a-z' -]*$/.test(term) ? term : '';
}
function pronunciations(entries: any[]) {
  const ipa: DictionaryWord['ipa'] = {},
    audio: DictionaryWord['audio'] = {};
  const audioSources: NonNullable<DictionaryWord['audioSources']> = {};
  let general = '';
  for (const entry of entries.slice(0, 6))
    for (const phonetic of Array.isArray(entry.phonetics)
      ? entry.phonetics
      : []) {
      const url = safeUrl(phonetic.audio),
        pronunciation = text(phonetic.text, 200);
      const accent = /[-_/](uk|gb)(?:[-_.\/]|$)/i.test(url || '')
        ? 'uk'
        : /[-_/]us(?:[-_.\/]|$)/i.test(url || '')
          ? 'us'
          : undefined;
      if (accent) {
        if (pronunciation && !ipa[accent]) ipa[accent] = pronunciation;
        if (url && !audio[accent]) audio[accent] = url;
        const source = safeUrl(phonetic.sourceUrl);
        if (source && !audioSources[accent]) audioSources[accent] = source;
      } else if (pronunciation && !general) general = pronunciation;
    }
  if (!ipa.us && general) ipa.us = general;
  if (!ipa.uk && general) ipa.uk = general;

  return { ipa, audio, audioSources };
}
export async function lookupDictionary(
  input?: string,
): Promise<DictionaryWord | null> {
  const word = normalizeDictionaryTerm(input);
  if (!word) return null;
  const hit = cache.get(word);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (pending.has(word)) return pending.get(word)!;
  const job = (async () => {
    try {
      const entries = await json(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      );
      if (!Array.isArray(entries) || !entries.length) {
        if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
        cache.set(word, { expires: Date.now() + 300_000, value: null });
        return null;
      }
      const translation = await json(
        'https://api.mymemory.translated.net/get?' +
          new URLSearchParams({ q: word, langpair: 'en|vi' }),
      ).catch(() => null);
      const translated =
        translation?.responseStatus === 200 && !translation.quotaFinished
          ? text(translation.responseData?.translatedText)
          : '';
      const { ipa, audio, audioSources } = pronunciations(entries);
      if (!ipa.us || !ipa.uk) {
        const fallback = await wiktionaryIpa(word);
        if (!ipa.us && fallback.us) ipa.us = fallback.us;
        if (!ipa.uk && fallback.uk) ipa.uk = fallback.uk;
      }
      let ipaDerivedFrom: string | undefined;
      if (!ipa.us || !ipa.uk) {
        const lemma = regularPluralLemma(word, entries);
        if (lemma) {
          const originals = await json(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lemma)}`,
          ).catch(() => null);
          if (Array.isArray(originals)) {
            const base = pronunciations(originals).ipa;
            for (const accent of ['us', 'uk'] as const) {
              if (!ipa[accent] && base[accent]) {
                const derived = pluralIpa(base[accent]!);
                if (derived) {
                  ipa[accent] = derived;
                  ipaDerivedFrom = lemma;
                }
              }
            }
          }
        }
      }
      const parts: DictionaryWord['parts'] = [];
      for (const entry of entries.slice(0, 4))
        for (const meaning of (Array.isArray(entry.meanings)
          ? entry.meanings
          : []
        ).slice(0, 5)) {
          const definitions = (
            Array.isArray(meaning.definitions) ? meaning.definitions : []
          )
            .filter((d: any) => text(d.definition))
            .slice(0, 3);
          if (definitions.length)
            parts.push({
              partOfSpeech: text(meaning.partOfSpeech, 40),
              meanings: definitions.map((d: any, i: number) => ({
                definition: text(d.definition),
                translation: translated && i === 0 ? [translated] : [],
                examples: text(d.example) ? [{ en: text(d.example) }] : [],
              })),
            });
        }
      const first = entries[0],
        value: DictionaryWord = {
          _id: '',
          word,
          slug: word,
          level: '',
          ipa,
          ...(ipaDerivedFrom ? { ipaDerivedFrom } : {}),
          audio,
          audioSources,
          parts,
          saved: false,
          sourceName: 'Free Dictionary API / Wiktionary',
          sourceUrl:
            safeUrl(first.sourceUrls?.[0]) ||
            `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
          licenseUrl: safeUrl(first.license?.url),
          ...(translated ? { translationSource: 'MyMemory' } : {}),
        };
      if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
      cache.set(word, {
        expires: Date.now() + (ipa.us && ipa.uk ? 86_400_000 : 300_000),
        value,
      });
      return value;
    } catch {
      throw new ServiceUnavailableException(
        'Không kết nối được từ điển. Hãy thử lại.',
      );
    } finally {
      pending.delete(word);
    }
  })();
  pending.set(word, job);
  return job;
}
