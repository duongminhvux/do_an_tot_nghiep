import { estimateToeicScore } from '@repo/shared-types/toeic-score';
/** Attempts store raw section results; the learner API derives the same estimated score. */
export function averageToeicScore(
  attempts: { listening_result: any; reading_result: any }[],
) {
  const scores = attempts
    .map((a) => estimateToeicScore(a.listening_result, a.reading_result)?.total)
    .filter((n): n is number => n != null);
  return scores.length
    ? scores.reduce((sum, n) => sum + n, 0) / scores.length
    : null;
}
