import type { SqlRow } from '../../../../postgres/row.js';
export type LearningSessionRow = SqlRow<LearningSession>;
export interface Session {
}
export interface LearningSession {
    userId: string;
    type: 'LESSON' | 'REVIEW';
    lessonId?: string;
    startedAt: Date;
    endedAt?: Date;
    durationSeconds?: number;
    totalWords: number;
    completedWords: number;
}
