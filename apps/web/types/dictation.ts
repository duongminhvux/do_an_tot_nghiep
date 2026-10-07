export type DictationLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type DictationAudioSource = 'TTS' | 'UPLOAD';

export interface DictationProgress {
  _id?: string;
  userId?: string;
  lessonId: string | DictationLessonSummary;
  currentSegment: number;
  completedSegments: number[];
  correctCount: number;
  wrongCount: number;
  attempts: number;
  completed: boolean;
  lastPracticedAt?: string;
}

export interface DictationLessonSummary {
  _id: string;
  title: string;
  slug: string;
  description: string;
  level: DictationLevel;
  topic: string;
  thumbnailUrl?: string;
  audioSource?: DictationAudioSource;
  language: 'en-US' | 'en-GB';
  voiceIds: string[];
  sentenceCount: number;
  totalDurationMs: number;
  fullAudioUrl?: string;
  publishedAt?: string;
  progress?: DictationProgress | null;
}

export interface DictationWordTiming {
  word: string;
  startMs: number;
  endMs: number;
  probability: number;
}

export interface DictationSegment {
  _id: string;
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
  /** Legacy only. New lessons use lesson.fullAudioUrl + startMs/endMs. */
  audioUrl?: string;
}

export interface DictationLessonDetail extends DictationLessonSummary {
  sourceText: string;
  speed: number;
  pauseAfterMs: number;
  segments: DictationSegment[];
}

export interface DictationProgressOverview {
  totalStarted: number;
  completed: number;
  totalCorrect: number;
  totalAttempts: number;
  items: DictationProgress[];
}
