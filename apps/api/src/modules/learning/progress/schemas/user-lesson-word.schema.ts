import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserLessonWordDocument = HydratedDocument<UserLessonWord>;

@Schema({ timestamps: true })
export class UserLessonWord {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'LessonWord',
    required: true,
    index: true,
  })
  lessonWordId: Types.ObjectId;

  @Prop()
  learnedAt?: Date;

  @Prop()
  completedAt?: Date;
}

export const UserLessonWordSchema =
  SchemaFactory.createForClass(UserLessonWord);

UserLessonWordSchema.index(
  { userId: 1, lessonWordId: 1 },
  { unique: true },
);