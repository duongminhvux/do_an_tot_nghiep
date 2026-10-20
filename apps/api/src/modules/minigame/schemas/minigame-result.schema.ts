import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { MiniGameType } from '../minigame.types.js';
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class MiniGameResult {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
  @Prop({ type: String, enum: MiniGameType, required: true })
  gameType: MiniGameType;
  @Prop({ required: true, min: 0, max: 10_000_000 }) score: number;
  createdAt: Date;
}
export const MiniGameResultSchema =
  SchemaFactory.createForClass(MiniGameResult);
MiniGameResultSchema.index({ userId: 1, gameType: 1, score: -1 });
MiniGameResultSchema.index({ userId: 1, gameType: 1, createdAt: -1 });
