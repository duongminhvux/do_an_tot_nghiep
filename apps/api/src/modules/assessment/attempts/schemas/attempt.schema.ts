import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AttemptDocument = HydratedDocument<Attempt>;

@Schema({ timestamps: true })
export class Attempt {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  examId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
    default: 'IN_PROGRESS',
  })
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

  @Prop({
    type: Date,
    required: true,
  })
  startedAt: Date;

  @Prop()
  completedAt?: Date;

  @Prop({
    default: 0,
    min: 0,
  })
  totalQuestions: number;

  @Prop({
    default: 0,
    min: 0,
  })
  answeredQuestions: number;

  @Prop({
    default: 0,
    min: 0,
  })
  correctAnswers: number;

  @Prop({
    default: 0,
    min: 0,
  })
  score?: number;
}

export const AttemptSchema = SchemaFactory.createForClass(Attempt);