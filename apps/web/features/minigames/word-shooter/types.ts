export type {
  GameStats,
  SourceType,
  WordSource,
  StartRequest,
  ScoreRecord,
} from "../typing-rush/types";
import type { WordSource } from "../typing-rush/types";
export type WordShooterSettings = {
  minWordCount: number;
  wordsPerRound: number;
  roundDurationSeconds: number;
  wrongShotPenaltySeconds: number;
};
export type GameWord = { id: string; word: string; meaning?: string };
export type GameSession = {
  gameType: "WORD_SHOOTER";
  config: WordShooterSettings;
  words: GameWord[];
};
export type Sources = {
  settings: WordShooterSettings;
  systemCollections: WordSource[];
  userCollections: WordSource[];
};
export type GameState = {
  status: "RUNNING" | "PAUSED" | "FINISHED";
  remainingMs: number;
  score: number;
  correct: number;
  wrong: number;
  round: number;
  target: GameWord;
  options: GameWord[];
  feedback: "correct" | "wrong" | null;
  shotId?: string;
  feedbackMs: number;
};
