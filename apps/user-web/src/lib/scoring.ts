import type { FeedbackSegmentDto } from "@/domain/dto";

export function normalizeText(value: string, options = { ignoreCase: true, ignorePunctuation: true, normalizeWhitespace: true }) {
  let result = value.trim();
  if (options.normalizeWhitespace) result = result.replace(/\s+/g, " ");
  if (options.ignoreCase) result = result.toLowerCase();
  if (options.ignorePunctuation) result = result.replace(/[^\p{L}\p{N}\s']/gu, "");
  return result;
}

export function scoreDictation(student: string, correct: string) {
  const studentWords = normalizeText(student).split(" ").filter(Boolean);
  const correctWords = normalizeText(correct).split(" ").filter(Boolean);
  const length = Math.max(studentWords.length, correctWords.length);
  let matches = 0;
  const feedbackSegments: FeedbackSegmentDto[] = [];
  for (let i = 0; i < length; i += 1) {
    const expected = correctWords[i];
    const actual = studentWords[i];
    if (actual === expected) { matches += 1; feedbackSegments.push({ value: actual, type: "CORRECT" }); }
    else if (!actual && expected) feedbackSegments.push({ value: expected, type: "MISSING" });
    else if (actual && !expected) feedbackSegments.push({ value: actual, type: "EXTRA" });
    else feedbackSegments.push({ value: `${actual} → ${expected}`, type: "REPLACED" });
  }
  return { score: Math.round((matches / Math.max(1, correctWords.length)) * 100), correctWords: matches, totalWords: correctWords.length, feedbackSegments };
}

export const bestScore = (scores: number[]) => scores.length ? Math.max(...scores) : 0;
export const courseProgress = (completed: number, total: number) => total ? Math.round((completed / total) * 100) : 0;
export const canConsumeListen = (current: number, maximum: number) => current < maximum;
export const canStartAttempt = (submittedAttempts: number, maximum: number) => submittedAttempts < maximum;
