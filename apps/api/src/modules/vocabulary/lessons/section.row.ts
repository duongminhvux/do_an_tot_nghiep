import type { SqlRow } from '../../../postgres/row.js';
export type SectionRow = SqlRow<Section>;
export interface Section {
    lessonId: string;
    name: string;
    slug: string;
    order?: number;
}
