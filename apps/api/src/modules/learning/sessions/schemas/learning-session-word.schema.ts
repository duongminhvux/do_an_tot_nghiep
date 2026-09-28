import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LearningSessionWordDocument =
  HydratedDocument<LearningSessionWord>;

@Schema({ timestamps: true })
export class LearningSessionWord {
  @Prop({
    type: Types.ObjectId,
    ref: 'LearningSession',
    required: true,
    index: true,
  })
  sessionId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Word',
    required: true,
    index: true,
  })
  wordId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'LessonWord',
  })
  lessonWordId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['FLASHCARD', 'MULTIPLE_CHOICE', 'TYPING'],
    required: true,
  })
  mode: 'FLASHCARD' | 'MULTIPLE_CHOICE' | 'TYPING';

  @Prop({
    type: String,
    enum: ['AGAIN', 'HARD', 'GOOD', 'EASY'],
  })
  rating?: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

  @Prop()
  isCorrect?: boolean;

  @Prop({
    type: Date,
    required: true,
  })
  answeredAt: Date;

  @Prop()
  scheduledAt?: Date;
}

export const LearningSessionWordSchema =
  SchemaFactory.createForClass(LearningSessionWord);