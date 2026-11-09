import { describe, it, expect } from 'vitest';
import { estimateToeicScore } from '@repo/shared-types/toeic-score';
import { averageToeicScore } from './toeic-average.js';
describe('dashboard uses the same estimated TOEIC scores as learner history', () => {
  it('derives the mean from raw sections without requiring the deliberately null score column', () => {
    const a = {
      listening_result: { total: 100, correct: 70 },
      reading_result: { total: 100, correct: 65 },
    };
    const b = {
      listening_result: { total: 100, correct: 50 },
      reading_result: { total: 100, correct: 45 },
    };
    expect(averageToeicScore([a, b])).toBe(
      (estimateToeicScore(a.listening_result, a.reading_result)!.total +
        estimateToeicScore(b.listening_result, b.reading_result)!.total) /
        2,
    );
    expect(
      averageToeicScore([{ listening_result: null, reading_result: null }]),
    ).toBeNull();
    expect(averageToeicScore([])).toBeNull();
  });
});
