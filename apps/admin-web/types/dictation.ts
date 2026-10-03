export type DictationLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type DictationStatus =
  | 'DRAFT'
  | 'PROCESSING_AUDIO'
  | 'READY'
  | 'PUBLISHED'
  | 'AUDIO_FAILED'
  | 'ARCHIVED';

export interface DictationVoice {
  id: string;
  name: string;
  language: 'en-US' | 'en-GB';
  gender: 'Female' | 'Male';
}

export interface DictationSegment {
  _id: string;
  lessonId: string;
  order: number;
  text: string;
  voiceId: string;
  language: 'en-US' | 'en-GB';
  speed: number;
  audioUrl: string;
  durationMs: number;
}

export interface DictationLesson {
  _id: string;
  title: string;
  slug: string;
  description: string;
  level: DictationLevel;
  topic: string;
  thumbnailUrl?: string;
  sourceText: string;
  language: 'en-US' | 'en-GB';
  voiceIds: string[];
  speed: number;
  pauseAfterMs: number;
  status: DictationStatus;
  sentenceCount: number;
  totalDurationMs: number;
  fullAudioUrl?: string;
  processingError?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  segments?: DictationSegment[];
}

export interface CreateDictationPayload {
  title: string;
  slug?: string;
  description?: string;
  level: DictationLevel;
  topic?: string;
  thumbnailUrl?: string;
  sourceText: string;
  language: 'en-US' | 'en-GB';
  voiceIds: string[];
  speed: number;
  pauseAfterMs: number;
}
