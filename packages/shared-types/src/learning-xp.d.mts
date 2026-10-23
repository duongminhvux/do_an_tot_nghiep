export type LearningModule =
  | "VOCABULARY"
  | "DICTATION"
  | "TOEIC"
  | "ARENA"
  | "MINIGAME";

export declare const LEARNING_MODULES: readonly LearningModule[];
export declare const DAILY_GOAL_XP: number;
export declare const XP: {
  readonly WORD_LEARNED: number;
  readonly WORD_REVIEWED: number;
  readonly VOCAB_SESSION: number;
  readonly DICTATION_LESSON: number;
  readonly DICTATION_PER_FIRST_TRY: number;
  readonly DICTATION_BONUS_MAX: number;
  readonly TOEIC_ATTEMPT: number;
  readonly TOEIC_PER_CORRECT: number;
  readonly TOEIC_BONUS_MAX: number;
  readonly ARENA_MATCH: number;
  readonly ARENA_WIN: number;
  readonly MINIGAME_PLAY: number;
};

/** 10 XP + 1 per sentence right on the first try (bonus capped at 20). */
export declare function dictationLessonXp(firstTryCorrect: number): number;
/** 10 XP + 1 per correct answer (bonus capped at 50). */
export declare function toeicAttemptXp(correct: number): number;
/** 10 XP per finished match, +10 for a win. */
export declare function arenaMatchXp(won: boolean): number;
