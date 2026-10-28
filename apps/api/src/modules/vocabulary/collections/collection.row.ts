import type { SqlRow } from '../../../postgres/row.js';
export type CollectionRow = SqlRow<Collection>;
export interface Collection {
    groupId?: string;
    name: string;
    slug: string;
    description?: string;
    coverUrl?: string;
    order?: number;
    isActive?: boolean;
    isDeleted?: boolean;
}
