import { MiniGameType } from './minigame.types.js';
export type TypingRushSettings = {
  minWordCount: number;
  lives: number;
  maxLives: number;
  initialFallSpeed: number;
  spawnInterval: number;
  heartEveryWords: number;
  meaningDurationSeconds: number;
};
export type MeaningTypingSettings = {
  minWordCount: number;
  lives: number;
  maxLives: number;
  initialFallSpeed: number;
  spawnInterval: number;
  heartEveryWords: number;
  hintPercent: number;
};
export const TYPING_RUSH_DEFAULT_SETTINGS: TypingRushSettings = {
  minWordCount: 10,
  lives: 3,
  maxLives: 3,
  initialFallSpeed: 45,
  spawnInterval: 1900,
  heartEveryWords: 20,
  meaningDurationSeconds: 3 };
export const MEANING_TYPING_DEFAULT_SETTINGS: MeaningTypingSettings = {
  minWordCount: 10,
  lives: 3,
  maxLives: 3,
  initialFallSpeed: 45,
  spawnInterval: 1900,
  heartEveryWords: 20,
  hintPercent: 35 };
export type WordShooterSettings = {
  minWordCount: number;
  wordsPerRound: number;
  roundDurationSeconds: number;
  wrongShotPenaltySeconds: number;
};
export const WORD_SHOOTER_DEFAULT_SETTINGS: WordShooterSettings = {
  minWordCount: 10,
  wordsPerRound: 6,
  roundDurationSeconds: 12,
  wrongShotPenaltySeconds: 2 };
// Register a game only after its frontend implementation and settings validator exist.
export const IMPLEMENTED_GAMES = {
  [MiniGameType.WORD_SHOOTER]: { destination: '/games/word-shooter' },
  [MiniGameType.TYPING_RUSH]: { destination: '/games/typing-rush' },
  [MiniGameType.MEANING_TYPING]: { destination: '/games/meaning-typing' } } as const;
export const IMPLEMENTED_GAME_CODES = Object.keys(IMPLEMENTED_GAMES);
