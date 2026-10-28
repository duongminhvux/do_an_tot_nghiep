import { GeneratedAudioMetadata } from '../../../../common/media/generated-audio.row.js';
import type { SqlRow } from '../../../../postgres/row.js';
export type QuestionRow = SqlRow<Question>;
export interface Question {
    examId: string;
    passageGroupId?: string;
    section: 'LISTENING' | 'READING';
    part: number;
    content: string;
    options: {
        key: 'A' | 'B' | 'C' | 'D';
        text: string;
    }[];
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    explanation?: string;
    imageUrl?: string;
    audioUrl?: string;
    audioMeta?: GeneratedAudioMetadata;
    importBatchId?: string;
    importIndex?: number;
    importFingerprint?: string;
    sourceOrder?: number;
    order: number;
    isActive: boolean;
}
