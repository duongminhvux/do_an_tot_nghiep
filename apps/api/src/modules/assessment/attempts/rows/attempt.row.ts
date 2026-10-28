import type { SqlRow } from '../../../../postgres/row.js';
import type { RawSectionResult,SnapshotQuestion } from '../attempt.types.js';
import { ExamMode,ToeicAttemptStatus } from '../attempt.types.js';
export type AttemptRow = SqlRow<Attempt>;
export interface Attempt {
    examPublicationRevision?: number;
    userId: string;
    examId: string;
    examSnapshot?: {
        _id: string;
        name: string;
        slug: string;
    };
    mode: ExamMode;
    selectedParts: number[];
    questionSnapshot: SnapshotQuestion[];
    answers: Record<string, string>;
    revealedAnswers?: Record<string, string>;
    audioPlayCounts: Record<string, number>;
    flaggedQuestions: string[];
    currentQuestionIndex: number;
    partResults?: (RawSectionResult & {
        part: number;
    })[];
    listeningResult?: RawSectionResult;
    readingResult?: RawSectionResult;
    resultVersion?: number;
    totalCorrect?: number;
    incorrectAnswers?: number;
    unansweredQuestions?: number;
    listeningCorrect?: number;
    readingCorrect?: number;
    accuracy?: number;
    durationSpent?: number;
    status: ToeicAttemptStatus | 'COMPLETED';
    startedAt: Date;
    completedAt?: Date;
    expiresAt?: Date;
    timeLimitSeconds?: number;
    submittedAt?: Date;
    totalQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    score?: number;
}
