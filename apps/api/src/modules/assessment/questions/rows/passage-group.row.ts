import type { SqlRow } from '../../../../postgres/row.js';
export type PassageGroupRow = SqlRow<PassageGroup>;
export interface PassageGroup {
    examId: string;
    section: 'LISTENING' | 'READING';
    part: number;
    title?: string;
    order: number;
}
