export type DictationLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type DictationStatus =
  | 'DRAFT'
  | 'PROCESSING_AUDIO'
  | 'READY'
  | 'PUBLISHED'
  | 'AUDIO_FAILED'
  | 'ARCHIVED';
export type DictationAudioSource = 'TTS' | 'UPLOAD';

export interface DictationVoice {
  id: string;
  name: string;
  language: 'en-US' | 'en-GB';
  gender: 'Female' | 'Male';
}

export interface DictationWordTiming {
  word: string;
  startMs: number;
  endMs: number;
  probability: number;
}

export interface DictationSection {
  _id: string;
  topicId: string;
  title: string;
  slug: string;
  description?: string;
  order: number;
  isActive: boolean;
  lessonCount?: number;
}

export interface DictationTopic {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  order: number;
  isActive: boolean;
  sections?: DictationSection[];
}

export interface DictationSegment {
  _id: string;
  lessonId: string;
  order: number;
  text: string;
  normalizedText?: string;
  source: 'TTS' | 'ASR';
  speaker?: string;
  voiceId?: string;
  language: 'en-US' | 'en-GB';
  speed: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  confidence?: number;
  words?: DictationWordTiming[];
}

export interface DictationLesson {
  _id: string;
  title: string;
  slug: string;
  description: string;
  level: DictationLevel;
  topic: string;
  topicId?: string;
  sectionId?: string;
  order?: number;
  thumbnailUrl?: string;
  audioSource: DictationAudioSource;
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
  audioProcessor?: string;
  audioProcessorDevice?: string;
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
  topicId?: string;
  sectionId?: string;
  order?: number;
  thumbnailUrl?: string;
  audioSource?: DictationAudioSource;
  sourceText?: string;
  language: 'en-US' | 'en-GB';
  voiceIds: string[];
  speed: number;
  pauseAfterMs: number;
}

export interface DictationSegmentEditPayload {
  order: number;
  text: string;
  startMs: number;
  endMs: number;
  speaker?: string;
}

export interface CreateDictationTopicPayload {
  title: string;
  slug?: string;
  description?: string;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  order?: number;
  isActive?: boolean;
}

export interface CreateDictationSectionPayload {
  topicId: string;
  title: string;
  slug?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}
