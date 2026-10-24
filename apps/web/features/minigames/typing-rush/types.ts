import type { GameAudioSettings } from "../shared/audio-settings";
export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type SourceType = "SYSTEM" | "USER";
export type WordSource = {
  id: string;
  name: string;
  thumbnail?: string;
  wordCount: number;
  type: SourceType;
};
export type Sources = {
  settings: GameAudioSettings & {
    minWordCount: number;
    lives: number;
    maxLives: number;
    initialFallSpeed: number;
    spawnInterval: number;
    heartEveryWords: number;
    meaningDurationSeconds: number;
  };
  systemCollections: WordSource[];
  userCollections: WordSource[];
};
export type StartRequest = {
  difficulty: Difficulty;
  sources: { id: string; type: SourceType }[];
};
export type GameSession = {
  gameType: "TYPING_RUSH";
  difficulty: Difficulty;
  config: GameAudioSettings & {
    lives: number;
    maxLives: number;
    initialFallSpeed: number;
    spawnInterval: number;
    heartEveryWords: number;
    meaningDurationSeconds: number;
  };
  words: { id: string; word: string; meaning?: string }[];
};
export type ScoreRecord = { id: string; score: number; createdAt: string };
export type GameStats = {
  bestScore: number;
  totalPlays: number;
  recentScores: ScoreRecord[];
};
export type FallingWord = {
  meaning?: string;
  kind: "NORMAL" | "HEART";
  instanceId: string;
  wordId: string;
  word: string;
  x: number;
  y: number;
  width: number;
  speed: number;
  spawnedAt: number;
  status: "FALLING" | "DESTROYED" | "MISSED";
};
export type HitEffect = {
  restoredLives: number;
  id: string;
  x: number;
  y: number;
  points: number;
  until: number;
};
export type MeaningNotice = {
  id: string;
  word: string;
  meaning: string;
  x: number;
  y: number;
  width: number;
  until: number;
};
export type GameState = {
  meanings: MeaningNotice[];
  wordsUntilHeart: number;
  heartPending: boolean;
  status: "RUNNING" | "PAUSED" | "FINISHED";
  words: FallingWord[];
  effects: HitEffect[];
  score: number;
  combo: number;
  bestCombo: number;
  lives: number;
  level: number;
  elapsed: number;
  correct: number;
  wordsAppeared: number;
  inputError: boolean;
};
