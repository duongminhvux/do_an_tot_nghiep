import type { SqlRow } from '../../../postgres/row.js';
export type VocabularyGroupRow = SqlRow<VocabularyGroup>;
export interface VocabularyGroup {
    name: string;
    slug: string;
    description?: string;
    order?: number;
    isActive?: boolean;
    isDeleted?: boolean;
}
