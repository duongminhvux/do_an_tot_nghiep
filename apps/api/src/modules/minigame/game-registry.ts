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
export const TYPING_RUSH_DEFAULT_SETTINGS: TypingRushSettings = {
  minWordCount: 10,
  lives: 3,
  maxLives: 3,
  initialFallSpeed: 45,
  spawnInterval: 1900,
  heartEveryWords: 20,
  meaningDurationSeconds: 3,
};
// Register a game only after its frontend implementation and settings validator exist.
export const IMPLEMENTED_GAMES = {
  [MiniGameType.TYPING_RUSH]: { destination: '/games/typing-rush' },
} as const;
export const IMPLEMENTED_GAME_CODES = Object.keys(IMPLEMENTED_GAMES);
