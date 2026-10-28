import type { SqlRow } from '../../../../postgres/row.js';
export type UserDailyActivityRow = SqlRow<UserDailyActivity>;
export interface UserDailyActivity {
    userId: string;
    date: Date;
    studyMinutes: number;
    wordsLearned: number;
    wordsReviewed: number;
    sessionCount: number;
}
