import type { WordGuessFeedback } from '../rows/arena-match.row.js';

/** Consume exact matches first so repeated letters never get excess yellow tiles. */
export function gradeWordGuess(
  answer: string,
  guess: string,
): WordGuessFeedback[] {
  const result: WordGuessFeedback[] = Array(5).fill('absent');
  const remaining = new Map<string, number>();
  for (let index = 0; index < 5; index++) {
    if (guess[index] === answer[index]) result[index] = 'correct';
    else
      remaining.set(answer[index]!, (remaining.get(answer[index]!) ?? 0) + 1);
  }
  for (let index = 0; index < 5; index++) {
    if (result[index] === 'correct') continue;
    const count = remaining.get(guess[index]!) ?? 0;
    if (count > 0) {
      result[index] = 'present';
      remaining.set(guess[index]!, count - 1);
    }
  }
  return result;
}
