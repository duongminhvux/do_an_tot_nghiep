import type { SqlRow } from '../../../../postgres/row.js';
export type UserLessonWordRow = SqlRow<UserLessonWord>;
export interface UserLessonWord {
    userId: string;
    lessonWordId: string;
    learnedAt?: Date;
    completedAt?: Date;
}
