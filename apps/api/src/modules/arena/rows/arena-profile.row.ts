import type { SqlRow } from '../../../postgres/row.js';
export type ArenaProfileRow = SqlRow<ArenaProfile>;
/** Hồ sơ xếp hạng và thống kê tích lũy của một người chơi Arena. */
export interface ArenaProfile {
    userId: string;
    rating: number;
    rankedMatches: number;
    rankedWins: number;
    rankedLosses: number;
    rankedDraws: number;
    currentWinStreak: number;
    bestWinStreak: number;
    createdAt: Date;
    updatedAt: Date;
}
