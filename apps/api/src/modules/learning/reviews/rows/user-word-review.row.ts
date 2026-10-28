import type { SqlRow } from '../../../../postgres/row.js';
export type UserWordReviewRow = SqlRow<UserWordReview>;
export interface Review {
}
export interface UserWordReview {
    userId: string;
    wordId: string;
    status: 'LEARNING' | 'MASTERED';
    reviewCount: number;
    correctCount: number;
    incorrectCount: number;
    intervalDays: number;
    lastReviewedAt?: Date;
    nextReviewAt?: Date;
}
