import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';

export type ArenaPlayerAnswerDocument = PgDocument<ArenaPlayerAnswer>;

@PgEntity({ timestamps: true })
/** Lưu các lần trả lời và điểm nhận được của người chơi cho từng câu. */
export class ArenaPlayerAnswer {
  @PgField({
    type: PgId,
    ref: 'ArenaMatch',
    required: true,
    index: true })
  matchId: PgId;

  @PgField({
    type: PgId,
    ref: 'ArenaMatchQuestion',
    required: true,
    index: true })
  matchQuestionId: PgId;

  @PgField({ type: PgId, ref: 'User', required: true, index: true })
  userId: PgId;

  @PgField({ type: String })
  selectedAnswer?: string;

  @PgField({ default: 0, min: 0 })
  attempts: number;

  @PgField({ default: false })
  isCorrect: boolean;

  @PgField({ default: false })
  timedOut: boolean;

  @PgField({ default: 0, min: 0 })
  responseTimeMs: number;

  @PgField({ default: 0 })
  earnedScore: number;

  @PgField({ default: 0, min: 0 })
  streakAtAnswer: number;

  @PgField({ type: Date })
  answeredAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaPlayerAnswerSchema =
  PgSchemaFactory.createForClass(ArenaPlayerAnswer);
ArenaPlayerAnswerSchema.index(
  { matchId: 1, matchQuestionId: 1, userId: 1 },
  { unique: true },
);
