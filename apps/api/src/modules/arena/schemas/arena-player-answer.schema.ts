import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

export type ArenaPlayerAnswerDocument = HydratedDocument<ArenaPlayerAnswer>;

@Schema({ timestamps: true })
/** Lưu các lần trả lời và điểm nhận được của người chơi cho từng câu. */
export class ArenaPlayerAnswer {
  @Prop({
    type: Types.ObjectId,
    ref: 'ArenaMatch',
    required: true,
    index: true,
  })
  matchId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'ArenaMatchQuestion',
    required: true,
    index: true,
  })
  matchQuestionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String })
  selectedAnswer?: string;

  @Prop({ default: 0, min: 0 })
  attempts: number;

  @Prop({ default: false })
  isCorrect: boolean;

  @Prop({ default: false })
  timedOut: boolean;

  @Prop({ default: 0, min: 0 })
  responseTimeMs: number;

  @Prop({ default: 0 })
  earnedScore: number;

  @Prop({ default: 0, min: 0 })
  streakAtAnswer: number;

  @Prop({ type: Date })
  answeredAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaPlayerAnswerSchema =
  SchemaFactory.createForClass(ArenaPlayerAnswer);
ArenaPlayerAnswerSchema.index(
  { matchId: 1, matchQuestionId: 1, userId: 1 },
  { unique: true },
);
