import type { SqlRow } from '../../../../postgres/row.js';
export type LearningSessionWordRow = SqlRow<LearningSessionWord>;
export interface LearningSessionWord {
    sessionId: string;
    wordId: string;
    lessonWordId?: string;
    mode: 'FLASHCARD' | 'MULTIPLE_CHOICE' | 'TYPING';
    rating?: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
    isCorrect?: boolean;
    answeredAt: Date;
    scheduledAt?: Date;
}
