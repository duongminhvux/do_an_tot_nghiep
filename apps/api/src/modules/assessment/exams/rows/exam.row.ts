import type { ExamTimingSettings } from '@repo/shared-types/exam-timing';
import type { SqlRow } from '../../../../postgres/row.js';
export type ExamRow = SqlRow<Exam>;
export interface Exam {
    publicationStatus: string;
    publicationRevision: number;
    publicationValidation?: Record<string, unknown>;
    name: string;
    slug: string;
    type: 'TOEIC' | 'IELTS';
    totalQuestions?: number;
    description?: string;
    durationMinutes: number;
    /** @jsonbPayload Saved per-exam timing, no baseline SQL column. */
    timingSettings?: ExamTimingSettings;
    isActive: boolean;
    order: number;
    groupId?: string | null;
    groupOrder: number;
    isDeleted: boolean;
}
