export declare const TOEIC_PART_COUNTS: Record<number, number>;

export type ExamCheckCode =
  | "EMPTY"
  | "EXAM_INCOMPLETE"
  | "EXAM_OVERFLOW"
  | "TOEIC_PART_COUNT"
  | "TOEIC_STRUCTURE"
  | "IMAGE_REQUIRED"
  | "AUDIO_REQUIRED"
  | "AUDIO_STALE"
  | "DUPLICATE";

export interface ExamCheckIssue {
  scope: "exam" | "part" | "group" | "question";
  code: ExamCheckCode;
  severity: "error" | "warning";
  message: string;
  part?: number;
  questionId?: string;
  order?: number;
  groupId?: string;
  passageId?: string;
  have?: number;
  need?: number;
}

export declare function checkExam(
  input: {
    exam?: { type?: string; totalQuestions?: number | null };
    questions: Record<string, any>[];
    groups: Record<string, any>[];
  },
  locale?: "vi" | "en" | string,
  options?: { counts?: boolean },
): ExamCheckIssue[];
