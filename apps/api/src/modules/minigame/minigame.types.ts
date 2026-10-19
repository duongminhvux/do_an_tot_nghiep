export enum MiniGameType {
  TYPING_RUSH = 'TYPING_RUSH',
  MEANING_TYPING = 'MEANING_TYPING',
}
export enum TypingRushDifficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
}
export enum MiniGameSourceType {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
}
export type GameWord = { id: string; word: string; meaning?: string };
export type VocabularySource = {
  id: string;
  name: string;
  thumbnail?: string;
  wordCount: number;
  type: MiniGameSourceType;
};
