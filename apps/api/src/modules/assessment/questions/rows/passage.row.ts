import { GeneratedAudioMetadata } from '../../../../common/media/generated-audio.row.js';
import type { SqlRow } from '../../../../postgres/row.js';
export type PassageRow = SqlRow<Passage>;
export interface Passage {
    passageGroupId: string;
    type: 'TEXT' | 'EMAIL' | 'ADVERTISEMENT' | 'ARTICLE' | 'NOTICE' | 'CHAT';
    content?: string;
    audioUrl?: string;
    audioMeta?: GeneratedAudioMetadata;
    imageUrl?: string;
    order: number;
}
