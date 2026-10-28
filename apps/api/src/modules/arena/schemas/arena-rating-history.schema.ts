import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';

export type ArenaRatingHistoryDocument = PgDocument<ArenaRatingHistory>;

/** Lịch sử thay đổi rating dùng cho thống kê và audit kết quả trận. */
export class ArenaRatingHistory {
  @PgField({ type: PgId, ref: 'User', required: true, index: true })
  userId: PgId;

  @PgField({
    type: PgId,
    ref: 'ArenaMatch',
    required: true,
    index: true })
  matchId: PgId;

  @PgField({ required: true, min: 0 })
  before: number;

  @PgField({ required: true, min: 0 })
  after: number;

  @PgField({ required: true })
  change: number;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaRatingHistorySchema =
  PgSchemaFactory.createForClass(ArenaRatingHistory);
