import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LearningSessionDocument = HydratedDocument<LearningSession>;

export class Session {}
@Schema({ timestamps: true })
export class LearningSession {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['LESSON', 'REVIEW'],
    required: true,
  })
  type: 'LESSON' | 'REVIEW';

  @Prop({
    type: Types.ObjectId,
    ref: 'Lesson',
  })
  lessonId?: Types.ObjectId;

  @Prop({
    type: Date,
    required: true,
  })
  startedAt: Date;

  @Prop()
  endedAt?: Date;

  @Prop({
    type: Number,
    default: 0,
  })
  totalWords: number;

  @Prop({
    type: Number,
    default: 0,
  })
  completedWords: number;
}

export const LearningSessionSchema =
  SchemaFactory.createForClass(LearningSession);