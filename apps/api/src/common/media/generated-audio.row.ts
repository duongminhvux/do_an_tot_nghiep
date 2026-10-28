import { AudioGenerationStatus,AudioSourceType } from './audio.types.js';
export { AudioGenerationStatus,AudioSourceType } from './audio.types.js';
export interface AudioSegmentMetadata {
    text?: string;
    speaker?: string;
    voiceId?: string;
    startMs: number;
    endMs: number;
}
export interface GeneratedAudioMetadata {
    source: AudioSourceType;
    status: AudioGenerationStatus;
    storageKey?: string;
    provider?: string;
    device?: string;
    language?: 'en-US' | 'en-GB';
    voiceIds?: string[];
    speed?: number;
    durationMs?: number;
    scriptHash?: string;
    generatedAt?: Date;
    error?: string;
    segments?: AudioSegmentMetadata[];
}
