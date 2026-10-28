import type { SqlRow } from '../../../postgres/row.js';
export type ArenaRatingHistoryRow = SqlRow<ArenaRatingHistory>;
/** Lịch sử thay đổi rating dùng cho thống kê và audit kết quả trận. */
export interface ArenaRatingHistory {
    userId: string;
    matchId: string;
    before: number;
    after: number;
    change: number;
    createdAt: Date;
    updatedAt: Date;
}
