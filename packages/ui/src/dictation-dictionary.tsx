import type { DictationWordEntry } from "./dictation-word-input";
type DictionaryResult = {
  _id: string;
  word: string;
  ipa?: { us?: string; uk?: string };
  audio?: { us?: string; uk?: string };
  saved?: boolean;
  parts?: Array<{
    partOfSpeech?: string;
    meanings: Array<{ translation?: string[] }>;
  }>;
  ipaDerivedFrom?: string;
  sourceName?: string;
  sourceUrl?: string;
  licenseUrl?: string;
  translationSource?: string;
};
export function dictationDictionaryEntry(
  found: DictionaryResult | null,
  word: string,
): DictationWordEntry {
  if (!found) return { id: "", word, meanings: [] };
  const translations = (found.parts || [])
    .flatMap((part) =>
      part.meanings.flatMap((meaning) => meaning.translation || []),
    )
    .map((value) => value.trim())
    .filter(Boolean);
  const meanings = [
    ...new Map(
      translations.map((value) => [value.toLocaleLowerCase(), value]),
    ).values(),
  ];
  return {
    id: found._id,
    word: found.word,
    ipa: found.ipa?.us,
    ipaUk: found.ipa?.uk,
    audioUs: found.audio?.us,
    audioUk: found.audio?.uk,
    meanings,
    saved: found.saved,
    partOfSpeech: found.parts?.[0]?.partOfSpeech,
    ipaDerivedFrom: found.ipaDerivedFrom,
    sourceName: found.sourceName,
    sourceUrl: found.sourceUrl,
    licenseUrl: found.licenseUrl,
    translationSource: found.translationSource,
  };
}
