export type MistakeSource = "TOEIC" | "DICTATION" | "VOCABULARY";
export interface LearningOutcome {
  sourceType: MistakeSource;
  sourceItemId: string;
  sourceRefId: string;
  title: string;
  samples: number;
  wrongCount: number;
}
export interface MistakeItem {
  id: string;
  sourceType: MistakeSource;
  sourceItemId: string;
  sourceRefId: string;
  title: string;
  wrongCount: number;
  reviewedCount: number;
  lastWrongAt: string;
  status: "PENDING" | "REVIEWED";
}
export interface MistakeList {
  items: MistakeItem[];
  total: number;
  pending: number;
  page: number;
  limit: number;
}
export interface MistakeDetail {
  available: boolean;
  title?: string;
  explanation?: string;
  correctAnswer?: string;
  selectedAnswer?: string;
  actionUrl?: string;
  reviewUrl?: string;
}
export interface MistakeStatistic {
  sourceType: MistakeSource;
  sourceItemId: string;
  title: string;
  learners: number;
  samples: number;
  wrongCount: number;
  errorRate: number;
}
export function toeicOutcomes(attempt: {
  _id: unknown;
  status: string;
  answers?: Record<string, string>;
  questionSnapshot?: {
    _id: string;
    part: number;
    content: string;
    correctAnswer: string;
  }[];
}): LearningOutcome[];
export function dictationOutcomes(
  progress: {
    completed: boolean;
    lessonId: unknown;
    segmentProgress?: {
      segmentIndex: number;
      attempts: number;
      wrongAttempts: number;
    }[];
  },
  segments: { _id: unknown; order: number; text: string }[],
): LearningOutcome[];
export function vocabularyOutcomes(
  sessionId: string,
  actions: { wordId: unknown; isCorrect?: boolean; rating?: string }[],
  titles: Record<string, string>,
): LearningOutcome[];
