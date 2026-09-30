import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDailyActivityDocument = HydratedDocument<UserDailyActivity>;

@Schema({ timestamps: true })
export class UserDailyActivity {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Date,
    required: true,
  })
  date: Date; // Chuẩn hóa về 00:00:00.000Z của ngày

  @Prop({
    type: Number,
    default: 0,
  })
  studyMinutes: number;

  @Prop({
    type: Number,
    default: 0,
  })
  wordsLearned: number;

  @Prop({
    type: Number,
    default: 0,
  })
  wordsReviewed: number;

  @Prop({
    type: Number,
    default: 0,
  })
  sessionCount: number;
}

export const UserDailyActivitySchema =
  SchemaFactory.createForClass(UserDailyActivity);

UserDailyActivitySchema.index({ userId: 1, date: 1 }, { unique: true });
