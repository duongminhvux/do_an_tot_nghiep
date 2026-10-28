import type { SqlRow } from '../../../postgres/row.js';
export type LessonRow = SqlRow<Lesson>;
export interface Lesson {
    publicationStatus: string;
    publicationRevision: number;
    publicationValidation?: Record<string, unknown>;
    collectionId: string;
    title: string;
    slug: string;
    description?: string;
    coverUrl?: string;
    order?: number;
    isActive?: boolean;
    isDeleted?: boolean;
}
