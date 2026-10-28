import type { SqlRow } from '../../../../postgres/row.js';
export type UserLessonProgressRow = SqlRow<UserLessonProgress>;
export interface UserLessonProgress {
    userId: string;
    lessonId: string;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    progress: number;
    startedAt?: Date;
    lastStudiedAt?: Date;
    completedAt?: Date;
}
