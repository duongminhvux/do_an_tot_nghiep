import type { SqlRow } from '../../../postgres/row.js';
export type DictationSectionRow = SqlRow<DictationSection>;
export interface DictationSection {
    topicId: string;
    title: string;
    slug: string;
    description: string;
    order: number;
    isActive: boolean;
    isDeleted: boolean;
}
