import type { SqlRow } from '../../../postgres/row.js';
export type DictationProgressRow = SqlRow<DictationProgress>;
export interface DictationSegmentProgress {
    segmentIndex: number;
    attempts: number;
    wrongAttempts: number;
    replayCount: number;
    correct: boolean;
    firstTryCorrect: boolean;
    revealed: boolean;
    completedAt?: Date;
}
export interface DictationProgress {
    userId: string;
    lessonId: string;
    currentSegment: number;
    completedSegments: number[];
    revealedSegments: number[];
    segmentProgress: DictationSegmentProgress[];
    correctCount: number;
    wrongCount: number;
    attempts: number;
    transcriptRevealed: boolean;
    transcriptRevealedAt?: Date;
    completed: boolean;
    lastPracticedAt: Date;
}
