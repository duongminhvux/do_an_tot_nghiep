import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExamDocument = HydratedDocument<Exam>;

@Schema({ timestamps: true })
export class Exam {
  @Prop({
    required: true,
    trim: true,
  })
  name: string;

  @Prop({
    required: true,
    trim: true,
  })
  slug: string;

  @Prop({
    required: true,
    enum: ['TOEIC', 'IELTS'],
  })
  type: 'TOEIC' | 'IELTS';

  @Prop({
    default: 0,
    min: 0,
  })
  totalQuestions?: number;

  @Prop({
    trim: true,
  })
  description?: string;

  @Prop({
    default: 0,
    min: 0,
  })
  durationMinutes: number;

  @Prop({
    default: true,
  })
  isActive: boolean;

  @Prop({
    default: 0,
    min: 0,
  })
  order: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'ExamGroup',
    default: null,
  })
  groupId?: Types.ObjectId | null;

  @Prop({
    default: false,
  })
  isDeleted: boolean;
}

export const ExamSchema = SchemaFactory.createForClass(Exam);

ExamSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } },
);
ExamSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } },
);
ExamSchema.index({ groupId: 1 });