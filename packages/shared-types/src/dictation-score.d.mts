export interface DictationGrade {
  score: number;
  isCorrect: boolean;
  errors: number;
  totalWords: number;
}
export function gradeDictation(
  expected: string,
  answer: string,
): DictationGrade;
