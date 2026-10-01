import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ timestamps: true })
export class Question {
  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  examId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Passage',
    index: true,
  })
  passageId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['LISTENING', 'READING'],
    index: true,
  })
  section: 'LISTENING' | 'READING';

  @Prop({
    required: true,
    min: 1,
    max: 7,
    index: true,
  })
  part: number;

  @Prop({
    required: true,
    trim: true,
  })
  content: string;

  @Prop({
    type: [
      {
        key: {
          type: String,
          enum: ['A', 'B', 'C', 'D'],
          required: true,
        },
        text: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    required: true,
  })
  options: {
    key: 'A' | 'B' | 'C' | 'D';
    text: string;
  }[];

  @Prop({
    required: true,
    enum: ['A', 'B', 'C', 'D'],
  })
  correctAnswer: 'A' | 'B' | 'C' | 'D';

  @Prop({
    trim: true,
  })
  explanation?: string;

  @Prop({
    trim: true,
  })
  audioUrl?: string;

  @Prop({
    trim: true,
  })
  imageUrl?: string;

  @Prop({
    default: 0,
    min: 0,
  })
  order: number;

  @Prop({
    default: true,
  })
  isActive: boolean;

  @Prop({
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  })
  status: 'ACTIVE' | 'INACTIVE';
}

export const QuestionSchema = SchemaFactory.createForClass(Question);