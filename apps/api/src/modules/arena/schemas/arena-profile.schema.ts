import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ArenaProfileDocument = HydratedDocument<ArenaProfile>;

@Schema({ timestamps: true })
/** Hồ sơ xếp hạng và thống kê tích lũy của một người chơi Arena. */
export class ArenaProfile {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: Number, default: 1000, min: 0 })
  rating: number;

  @Prop({ type: Number, default: 0, min: 0 })
  rankedMatches: number;

  @Prop({ type: Number, default: 0, min: 0 })
  rankedWins: number;

  @Prop({ type: Number, default: 0, min: 0 })
  rankedLosses: number;

  @Prop({ type: Number, default: 0, min: 0 })
  rankedDraws: number;

  @Prop({ type: Number, default: 0, min: 0 })
  currentWinStreak: number;

  @Prop({ type: Number, default: 0, min: 0 })
  bestWinStreak: number;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaProfileSchema = SchemaFactory.createForClass(ArenaProfile);
