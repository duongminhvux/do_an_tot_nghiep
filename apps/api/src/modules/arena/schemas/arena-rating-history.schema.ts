import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

export type ArenaRatingHistoryDocument = HydratedDocument<ArenaRatingHistory>;

@Schema({ timestamps: true })
/** Lịch sử thay đổi rating dùng cho thống kê và audit kết quả trận. */
export class ArenaRatingHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'ArenaMatch',
    required: true,
    index: true,
  })
  matchId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  before: number;

  @Prop({ required: true, min: 0 })
  after: number;

  @Prop({ required: true })
  change: number;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaRatingHistorySchema =
  SchemaFactory.createForClass(ArenaRatingHistory);
ArenaRatingHistorySchema.index({ matchId: 1, userId: 1 }, { unique: true });
