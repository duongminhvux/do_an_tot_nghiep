import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AttemptAnswerDocument = HydratedDocument<AttemptAnswer>;

@Schema({ timestamps: true })
export class AttemptAnswer {
  @Prop({
    type: Types.ObjectId,
    ref: 'Attempt',
    required: true,
    index: true,
  })
  attemptId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Question',
    required: true,
    index: true,
  })
  questionId: Types.ObjectId;

  @Prop({
    enum: ['A', 'B', 'C', 'D'],
  })
  selectedAnswer?: 'A' | 'B' | 'C' | 'D';

  @Prop({
    default: false,
  })
  isCorrect: boolean;

  @Prop()
  answeredAt?: Date;
}

export const AttemptAnswerSchema =
  SchemaFactory.createForClass(AttemptAnswer);

AttemptAnswerSchema.index(
  {
    attemptId: 1,
    questionId: 1,
  },
  {
    unique: true,
  },
);