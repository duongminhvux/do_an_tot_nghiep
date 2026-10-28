import { GeneratedAudioMetadata } from '../../../common/media/generated-audio.row.js';
import type { SqlRow } from '../../../postgres/row.js';
export type WordRow = SqlRow<Word>;
/**
 * IPA
 */
export interface WordIpa {
    us?: string;
    uk?: string;
}
/**
 * Audio
 */
export interface WordAudio {
    us?: string;
    uk?: string;
}
export interface WordAudioMetadata {
    us?: GeneratedAudioMetadata;
    uk?: GeneratedAudioMetadata;
}
/**
 * Example
 */
export interface WordExample {
    en?: string;
    vi?: string;
}
/**
 * Meaning
 */
export interface WordMeaning {
    definition?: string;
    translation: string[];
    synonyms: string[];
    antonyms: string[];
    examples: WordExample[];
}
/**
 * Part of speech
 */
export interface WordPart {
    partOfSpeech: string;
    meanings: WordMeaning[];
}
/**
 * Word
 */
export interface Word {
    publicationStatus: string;
    publicationRevision: number;
    publicationValidation?: Record<string, unknown>;
    word: string;
    slug: string;
    level: string;
    ipa: WordIpa;
    audio: WordAudio;
    audioMeta: WordAudioMetadata;
    image?: string;
    variations: string[];
    relatedWords: string[];
    parts: WordPart[];
    isActive: boolean;
    isDeleted: boolean;
}
