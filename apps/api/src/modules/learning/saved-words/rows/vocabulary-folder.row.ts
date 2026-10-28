import type { SqlRow } from '../../../../postgres/row.js';
export type VocabularyFolderRow = SqlRow<VocabularyFolder>;
export interface VocabularyFolder {
    userId: string;
    name: string;
    slug?: string;
    description: string;
    createdAt?: Date;
    updatedAt?: Date;
}
