import type { SqlRow } from '../../../postgres/row.js';
export type DictationSegmentRow = SqlRow<DictationSegment>;
export interface DictationWordTiming {
    word: string;
    startMs: number;
    endMs: number;
    probability: number;
}
export interface DictationSegment {
    lessonId: string;
    order: number;
    text: string;
    normalizedText: string;
    source: 'TTS' | 'ASR';
    speaker: string;
    voiceId: string;
    language: 'en-US' | 'en-GB';
    speed: number;
    startMs: number;
    endMs: number;
    durationMs: number;
    confidence: number;
    words: DictationWordTiming[];
    audioUrl?: string;
    audioPublicId?: string;
}
