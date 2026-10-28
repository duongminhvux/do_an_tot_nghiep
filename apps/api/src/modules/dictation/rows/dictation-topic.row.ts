import type { SqlRow } from '../../../postgres/row.js';
export type DictationTopicRow = SqlRow<DictationTopic>;
export interface DictationTopic {
    title: string;
    slug: string;
    description: string;
    thumbnailUrl: string;
    thumbnailPublicId: string;
    order: number;
    isActive: boolean;
    isDeleted: boolean;
}
