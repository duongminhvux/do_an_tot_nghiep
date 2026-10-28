import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';

export type ArenaProfileDocument = PgDocument<ArenaProfile>;

/** Hồ sơ xếp hạng và thống kê tích lũy của một người chơi Arena. */
export class ArenaProfile {
  @PgField({
    type: PgId,
    ref: 'User',
    required: true,
    unique: true,
    index: true })
  userId: PgId;

  @PgField({ type: Number, default: 1000, min: 0 })
  rating: number;

  @PgField({ type: Number, default: 0, min: 0 })
  rankedMatches: number;

  @PgField({ type: Number, default: 0, min: 0 })
  rankedWins: number;

  @PgField({ type: Number, default: 0, min: 0 })
  rankedLosses: number;

  @PgField({ type: Number, default: 0, min: 0 })
  rankedDraws: number;

  @PgField({ type: Number, default: 0, min: 0 })
  currentWinStreak: number;

  @PgField({ type: Number, default: 0, min: 0 })
  bestWinStreak: number;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaProfileSchema = PgSchemaFactory.createForClass(ArenaProfile);
