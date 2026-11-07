export interface DictationLearner {
  id: string;
  user_id: string;
  username: string | null;
  completed: boolean;
  completed_segments: number[];
  revealed_segments: number[];
  segment_progress: {
    segmentIndex: number;
    attempts: number;
    wrongAttempts: number;
    replayCount: number;
    correct: boolean;
    firstTryCorrect: boolean;
    revealed: boolean;
  }[];
  correct_count: number;
  wrong_count: number;
  attempts: number;
  last_practiced_at: string;
  sentence_count: number;
}
export interface DictationPracticeSession {
  id: string;
  user_id: string;
  username: string | null;
  started_at: string;
  last_activity_at: string;
  ended_at: string | null;
  completed: boolean;
  sentence_count: number;
  attempts: number;
  correct: number;
  replays: number;
  reveals: number;
  duration_sec: number;
  status: "ACTIVE" | "ENDED" | "COMPLETED";
}
export interface DictationHistoryEvent {
  id: string;
  action:
    "ATTEMPT" | "REPLAY" | "REVEAL_SEGMENT" | "REVEAL_TRANSCRIPT" | "RESET";
  segment_index: number | null;
  submitted_text: string | null;
  reference_text: string | null;
  is_correct: boolean | null;
  occurred_at: string;
}
export interface DictationHistoryPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface DictationLearnersPage extends DictationHistoryPage<DictationLearner> {
  summary: {
    learners: number;
    completed: number;
    correct: number;
    attempts: number;
    sessions: number;
  };
}
