import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ArenaMatchPlayerDocument = HydratedDocument<ArenaMatchPlayer>;

@Schema({ timestamps: true })
/** Điểm số, trạng thái ready và kết quả của một người trong trận. */
export class ArenaMatchPlayer {
  @Prop({
    type: Types.ObjectId,
    ref: 'ArenaMatch',
    required: true,
    index: true,
  })
  matchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 0, min: 0 })
  correctAnswers: number;

  @Prop({ default: 0, min: 0 })
  wrongAnswers: number;

  @Prop({ default: 0, min: 0 })
  unanswered: number;

  @Prop({ default: 0, min: 0 })
  longestStreak: number;

  @Prop({ default: 0, min: 0 })
  currentStreak: number;

  @Prop({ default: 0, min: 0 })
  totalResponseTimeMs: number;

  @Prop({ type: [Types.ObjectId], ref: 'ArenaMatchQuestion', default: [] })
  scoredQuestionIds: Types.ObjectId[];

  @Prop({ default: 0, min: 0 })
  ratingBefore: number;

  @Prop({ default: 0, min: 0 })
  ratingAfter: number;

  @Prop({ default: 0 })
  ratingChange: number;

  @Prop({
    type: Boolean,
    default: false,
  })
  isReady: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  readyAt?: Date | null;

  @Prop({ type: Date, default: null })
  disconnectedAt?: Date | null;

  @Prop({
    type: String,
    enum: ['PLAYING', 'FINISHED', 'LEFT', 'DISCONNECTED'],
    default: 'PLAYING',
  })
  status: 'PLAYING' | 'FINISHED' | 'LEFT' | 'DISCONNECTED';

  @Prop({ type: Date })
  finishedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaMatchPlayerSchema =
  SchemaFactory.createForClass(ArenaMatchPlayer);
ArenaMatchPlayerSchema.index({ matchId: 1, userId: 1 }, { unique: true });
