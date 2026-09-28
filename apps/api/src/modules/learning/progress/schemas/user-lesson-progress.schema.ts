import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserLessonProgressDocument =
  HydratedDocument<UserLessonProgress>;

@Schema({ timestamps: true })
export class UserLessonProgress {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Lesson',
    required: true,
    index: true,
  })
  lessonId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
    default: 'NOT_STARTED',
  })
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

  @Prop({
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  })
  progress: number;

  @Prop()
  startedAt?: Date;

  @Prop()
  lastStudiedAt?: Date;

  @Prop()
  completedAt?: Date;
}

export const UserLessonProgressSchema =
  SchemaFactory.createForClass(UserLessonProgress);

UserLessonProgressSchema.index(
  { userId: 1, lessonId: 1 },
  { unique: true },
);