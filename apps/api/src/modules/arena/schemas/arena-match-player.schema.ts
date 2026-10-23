import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { ArenaFriendMode } from './arena-match.schema.js';

export type ArenaMatchPlayerDocument = PgDocument<ArenaMatchPlayer>;

@PgEntity({ timestamps: true })
/** Điểm số, trạng thái ready và kết quả của một người trong trận. */
export class ArenaMatchPlayer {
  @PgField({ type: String, enum: Object.values(ArenaFriendMode), default: null })
  readyMode?: ArenaFriendMode | null;
  @PgField({
    type: PgId,
    ref: 'ArenaMatch',
    required: true,
    index: true })
  matchId: PgId;

  @PgField({ type: PgId, ref: 'User', required: true, index: true })
  userId: PgId;

  @PgField({ default: false })
  returnedToLobby: boolean;

  @PgField({ default: false })
  leftLobby: boolean;

  @PgField({ default: 0 })
  score: number;

  @PgField({ default: 0, min: 0 })
  correctAnswers: number;

  @PgField({ default: 0, min: 0 })
  wrongAnswers: number;

  @PgField({ default: 0, min: 0 })
  unanswered: number;

  @PgField({ default: 0, min: 0 })
  longestStreak: number;

  @PgField({ default: 0, min: 0 })
  currentStreak: number;

  @PgField({ default: 0, min: 0 })
  totalResponseTimeMs: number;

  @PgField({ type: [PgId], ref: 'ArenaMatchQuestion', default: [] })
  scoredQuestionIds: PgId[];

  @PgField({ default: 0, min: 0 })
  ratingBefore: number;

  @PgField({ default: 0, min: 0 })
  ratingAfter: number;

  @PgField({ default: 0 })
  ratingChange: number;

  @PgField({
    type: Boolean,
    default: false })
  isReady: boolean;

  @PgField({
    type: Date,
    default: null })
  readyAt?: Date | null;

  @PgField({ type: Date, default: null })
  disconnectedAt?: Date | null;

  @PgField({
    type: String,
    enum: ['PLAYING', 'FINISHED', 'LEFT', 'DISCONNECTED'],
    default: 'PLAYING' })
  status: 'PLAYING' | 'FINISHED' | 'LEFT' | 'DISCONNECTED';

  @PgField({ type: Date })
  finishedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaMatchPlayerSchema =
  PgSchemaFactory.createForClass(ArenaMatchPlayer);
ArenaMatchPlayerSchema.index({ matchId: 1, userId: 1 }, { unique: true });
