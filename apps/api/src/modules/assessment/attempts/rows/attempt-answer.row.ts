import type { SqlRow } from '../../../../postgres/row.js';
export type AttemptAnswerRow = SqlRow<AttemptAnswer>;
export interface AttemptAnswer {
    attemptId: string;
    questionId: string;
    selectedAnswer?: 'A' | 'B' | 'C' | 'D';
    isCorrect: boolean;
    answeredAt?: Date;
}
