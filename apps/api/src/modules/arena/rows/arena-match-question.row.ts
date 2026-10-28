import type { SqlRow } from '../../../postgres/row.js';
export type ArenaMatchQuestionRow = SqlRow<ArenaMatchQuestion>;
export interface ArenaQuestionOption {
    key: string;
    text: string;
}
/** Snapshot câu hỏi được cố định cho một trận để mọi client dùng cùng dữ liệu. */
export interface ArenaMatchQuestion {
    matchId: string;
    vocabularyId?: string;
    order: number;
    type: 'WORD_TO_MEANING' | 'MEANING_TO_WORD' | 'LISTENING' | 'CONTEXT';
    question: string;
    audioUrl?: string;
    imageUrl?: string;
    options: ArenaQuestionOption[];
    correctAnswer: string;
    explanation?: string;
    example?: string;
    translation?: string;
    wordType?: string;
    startedAt?: Date;
    resolvedAt?: Date | null;
    winnerId?: string | null;
    createdAt: Date;
    updatedAt: Date;
}
