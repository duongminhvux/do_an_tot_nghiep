import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserWordReviewDocument = HydratedDocument<UserWordReview>;

export class Review {}
@Schema({ timestamps: true })
export class UserWordReview {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Word',
    required: true,
    index: true,
  })
  wordId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['LEARNING', 'MASTERED'],
    default: 'LEARNING',
  })
  status: 'LEARNING' | 'MASTERED';

  @Prop({
    type: Number,
    default: 0,
  })
  reviewCount: number;

  @Prop({
    type: Number,
    default: 0,
  })
  correctCount: number;

  @Prop({
    type: Number,
    default: 0,
  })
  incorrectCount: number;

  @Prop({
    type: Number,
    default: 0,
  })
  intervalDays: number;

  @Prop()
  lastReviewedAt?: Date;

  @Prop()
  nextReviewAt?: Date;
}

export const UserWordReviewSchema =
  SchemaFactory.createForClass(UserWordReview);

UserWordReviewSchema.index(
  { userId: 1, wordId: 1 },
  { unique: true },
);

UserWordReviewSchema.index({
  userId: 1,
  nextReviewAt: 1,
});