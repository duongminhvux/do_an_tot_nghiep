import { describe, expect, it } from 'vitest';
import { maskArenaAnswer } from './arena-round.utils.js';

describe('Arena clue masking', () => {
  it('masks complete inflected words without exposing suffixes or hiding unrelated words', () => {
    expect(
      maskArenaAnswer(
        'She does it. They did it and have done it. DO it!',
        'do',
      ),
    ).toBe('She _____ it. They _____ it and have _____ it. _____ it!');
    expect(maskArenaAnswer('The dog is by the door.', 'do')).toBe(
      'The dog is by the door.',
    );
    expect(
      maskArenaAnswer('She studies, studied and is studying.', 'study'),
    ).toBe('She _____, _____ and is _____.');
    expect(maskArenaAnswer('He stopped stopping to stop.', 'stop')).toBe(
      'He _____ _____ to _____.',
    );
    expect(maskArenaAnswer('She is making cakes.', 'make')).toBe(
      'She is _____ cakes.',
    );
    expect(maskArenaAnswer('A scar beside a car.', 'car')).toBe(
      'A scar beside a _____.',
    );
    expect(maskArenaAnswer('Use C++ or C++17.', 'C++')).toBe(
      'Use _____ or C++17.',
    );
  });
  it('preserves phrase, Unicode, punctuation and empty clue handling', () => {
    expect(
      maskArenaAnswer(
        'An \uff29\uff23\uff25   \uff23\uff32\uff25\uff21\uff2d.',
        'ice cream',
      ),
    ).toBe('An _____.');
    expect(maskArenaAnswer('Use C++.', 'C++')).toBe('Use _____.');
    expect(maskArenaAnswer(undefined, 'do')).toBeUndefined();
    expect(maskArenaAnswer('Keep this.', ' ')).toBe('Keep this.');
  });
});
