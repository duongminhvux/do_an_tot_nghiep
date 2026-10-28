import type { SqlRow } from '../../../postgres/row.js';
export type DictationLessonRow = SqlRow<DictationLesson>;
export enum DictationLevel {
    A1 = 'A1',
    A2 = 'A2',
    B1 = 'B1',
    B2 = 'B2',
    C1 = 'C1',
    C2 = 'C2'
}
export enum DictationStatus {
    DRAFT = 'DRAFT',
    PROCESSING_AUDIO = 'PROCESSING_AUDIO',
    READY = 'READY',
    PUBLISHED = 'PUBLISHED',
    AUDIO_FAILED = 'AUDIO_FAILED',
    ARCHIVED = 'ARCHIVED'
}
export enum DictationAudioSource {
    TTS = 'TTS',
    UPLOAD = 'UPLOAD'
}
export interface DictationLesson {
    publicationStatus: string;
    publicationRevision: number;
    publicationValidation?: Record<string, unknown>;
    title: string;
    slug: string;
    description: string;
    level: DictationLevel;
    topic: string;
    topicId?: string;
    sectionId?: string;
    order: number;
    thumbnailUrl: string;
    audioSource: DictationAudioSource;
    sourceText: string;
    language: 'en-US' | 'en-GB';
    voiceIds: string[];
    speed: number;
    pauseAfterMs: number;
    status: DictationStatus;
    sentenceCount: number;
    totalDurationMs: number;
    fullAudioUrl: string;
    fullAudioStorageKey: string;
    fullAudioPublicId: string;
    processingError: string;
    audioProcessor: string;
    audioProcessorDevice: string;
    isDeleted: boolean;
    publishedAt?: Date;
}
