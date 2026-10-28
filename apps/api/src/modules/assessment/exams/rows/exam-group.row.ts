import type { SqlRow } from '../../../../postgres/row.js';
export type ExamGroupRow = SqlRow<ExamGroup>;
export interface ExamGroup {
    name: string;
    slug: string;
    description?: string;
    order: number;
    isActive: boolean;
    isDeleted: boolean;
}
