import type { SqlRow } from '../../../postgres/row.js';
import { ArenaFriendMode } from './arena-match.row.js';
export type ArenaMatchPlayerRow = SqlRow<ArenaMatchPlayer>;
/** Điểm số, trạng thái ready và kết quả của một người trong trận. */
export interface ArenaMatchPlayer {
    readyMode?: ArenaFriendMode | null;
    matchId: string;
    userId: string;
    returnedToLobby: boolean;
    leftLobby: boolean;
    score: number;
    correctAnswers: number;
    wrongAnswers: number;
    unanswered: number;
    longestStreak: number;
    currentStreak: number;
    totalResponseTimeMs: number;
    scoredQuestionIds: string[];
    ratingBefore: number;
    ratingAfter: number;
    ratingChange: number;
    isReady: boolean;
    readyAt?: Date | null;
    disconnectedAt?: Date | null;
    status: 'PLAYING' | 'FINISHED' | 'LEFT' | 'DISCONNECTED';
    finishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
