export type DictationLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type DictationAudioSource = 'TTS' | 'UPLOAD';

export interface DictationSegmentProgress {
  segmentIndex: number;
  attempts: number;
  wrongAttempts: number;
  replayCount: number;
  correct: boolean;
  firstTryCorrect: boolean;
  revealed: boolean;
  completedAt?: string;
}

export interface DictationProgress {
  _id?: string;
  userId?: string;
  lessonId: string | DictationLessonSummary;
  currentSegment: number;
  completedSegments: number[];
  revealedSegments?: number[];
  segmentProgress?: DictationSegmentProgress[];
  correctCount: number;
  wrongCount: number;
  attempts: number;
  transcriptRevealed?: boolean;
  transcriptRevealedAt?: string;
  completed: boolean;
  lastPracticedAt?: string;
}

export interface DictationTopicSummary {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  order: number;
  sectionCount: number;
  lessonCount: number;
  sentenceCount: number;
  totalDurationMs: number;
  levels: DictationLevel[];
  completedLessons: number;
}

export interface DictationSectionSummary {
  _id: string;
  topicId: string;
  title: string;
  slug: string;
  description?: string;
  order: number;
  lessons: DictationLessonSummary[];
}

export interface DictationTopicDetail extends DictationTopicSummary {
  sections: DictationSectionSummary[];
}

export interface DictationLessonSummary {
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
  audioUrl?: string;
}

export interface DictationLessonDetail extends DictationLessonSummary {
  sourceText: string;
  speed: number;
  pauseAfterMs: number;
  segments: DictationSegment[];
  topicInfo?: { _id: string; title: string; slug: string } | null;
  sectionInfo?: { _id: string; title: string; slug: string } | null;
  practiceSettings?: {
    maxAttemptsBeforeReveal: number;
    autoNextDelayMs: number;
  };
}

export interface DictationProgressOverview {
  totalStarted: number;
  completed: number;
  totalCorrect: number;
  totalAttempts: number;
  items: DictationProgress[];
}
