// XP awarded for each kind of learning activity. Shared by the API (live
// recording) and the backfill script so both always agree.

export const LEARNING_MODULES = [
  "VOCABULARY",
  "DICTATION",
  "TOEIC",
  "ARENA",
  "MINIGAME",
];

export const DAILY_GOAL_XP = 50;

export const XP = {
  WORD_LEARNED: 2,
  WORD_REVIEWED: 1,
  VOCAB_SESSION: 10,
  DICTATION_LESSON: 10,
  DICTATION_PER_FIRST_TRY: 1,
  DICTATION_BONUS_MAX: 20,
  TOEIC_ATTEMPT: 10,
  TOEIC_PER_CORRECT: 1,
  TOEIC_BONUS_MAX: 50,
  ARENA_MATCH: 10,
  ARENA_WIN: 10,
  MINIGAME_PLAY: 5,
};

const bonus = (count, per, max) =>
  Math.min(max, Math.max(0, Math.floor(count || 0)) * per);

export function dictationLessonXp(firstTryCorrect) {
  return (
    XP.DICTATION_LESSON +
    bonus(firstTryCorrect, XP.DICTATION_PER_FIRST_TRY, XP.DICTATION_BONUS_MAX)
  );
}

export function toeicAttemptXp(correct) {
  return (
    XP.TOEIC_ATTEMPT + bonus(correct, XP.TOEIC_PER_CORRECT, XP.TOEIC_BONUS_MAX)
  );
}

export function arenaMatchXp(won) {
  return XP.ARENA_MATCH + (won ? XP.ARENA_WIN : 0);
}
