export interface DictationGrade {
  score: number;
  isCorrect: boolean;
  errors: number;
  totalWords: number;
}
export interface DictationGradeOptions {
  caseSensitive?: boolean;
  punctuationSensitive?: boolean;
  /** Score (0-100) needed to count as correct; 100 = exact match. */
  passScore?: number;
}
export function gradeDictation(
  expected: string,
  answer: string,
  options?: DictationGradeOptions,
): DictationGrade;
