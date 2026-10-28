import type { SqlRow } from '../../../postgres/row.js';
export type LessonWordRow = SqlRow<LessonWord>;
export interface LessonWord {
    lessonId: string;
    wordId: string;
    sectionId?: string;
    order?: number;
    customNote?: string;
}
