import { gradeWordGuess } from './word-guess.utils.js';

describe('five-letter guess feedback', () => {
  it('marks exact matches green and absent letters gray', () => {
    expect(gradeWordGuess('apple', 'apple')).toEqual(Array(5).fill('correct'));
    expect(gradeWordGuess('apple', 'bound')).toEqual(Array(5).fill('absent'));
  });
  it('marks existing letters in the wrong position yellow', () => {
    expect(gradeWordGuess('apple', 'pearl')).toEqual([
      'present',
      'present',
      'present',
      'absent',
      'present',
    ]);
  });
  it('reserves exact matches before assigning repeated yellow letters', () => {
    expect(gradeWordGuess('apple', 'allee')).toEqual([
      'correct',
      'present',
      'absent',
      'absent',
      'correct',
    ]);
    expect(gradeWordGuess('apple', 'ppppp')).toEqual([
      'absent',
      'correct',
      'correct',
      'absent',
      'absent',
    ]);
    expect(gradeWordGuess('abbey', 'babbb')).toEqual([
      'present',
      'present',
      'correct',
      'absent',
      'absent',
    ]);
  });
});
