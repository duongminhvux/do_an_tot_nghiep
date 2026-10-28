import type { SqlRow } from '../../../postgres/row.js';
export type ArenaPlayerAnswerRow = SqlRow<ArenaPlayerAnswer>;
/** Lưu các lần trả lời và điểm nhận được của người chơi cho từng câu. */
export interface ArenaPlayerAnswer {
    matchId: string;
    matchQuestionId: string;
    userId: string;
    selectedAnswer?: string;
    attempts: number;
    isCorrect: boolean;
    timedOut: boolean;
    responseTimeMs: number;
    earnedScore: number;
    streakAtAnswer: number;
    answeredAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
