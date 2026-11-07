export type ExerciseModule =
  "toeic" | "vocabulary" | "dictation" | "arena" | "minigame";
export interface ExerciseRecord {
  id: string;
  module: ExerciseModule;
  title: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationSec: number | null;
  correct: number | null;
  total: number | null;
  score: number | null;
  scoreMax: number | null;
  metadata: {
    mode?: string;
    type?: string;
    result?: string;
    ratingChange?: number;
    summaryOnly?: boolean;
    completedWords?: number;
    totalWords?: number;
  };
}
export interface ExerciseRow {
  id: string;
  index: number;
  prompt: string;
  submitted: string | null;
  expected: string | null;
  correct: boolean | null;
  occurredAt: string | null;
  metadata?: {
    action?: string;
    segmentIndex?: number | null;
    part?: number;
    explanation?: string;
    rating?: string;
    mode?: string;
    points?: number;
    attempts?: number;
  };
}
export interface ExercisePage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface ExerciseDetail extends ExercisePage<ExerciseRow> {
  record: ExerciseRecord;
}
