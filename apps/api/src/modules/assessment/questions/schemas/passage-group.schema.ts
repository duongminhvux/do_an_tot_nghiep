import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PassageGroupDocument = HydratedDocument<PassageGroup>;

@Schema({ timestamps: true })
export class PassageGroup {
  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  examId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['LISTENING', 'READING'],
  })
  section: 'LISTENING' | 'READING';

  @Prop({
    required: true,
    min: 1,
    max: 7,
  })
  part: number;

  @Prop({
    trim: true,
  })
  title?: string;

  @Prop({
    default: 0,
    min: 0,
  })
  order: number;
}

export const PassageGroupSchema =
  SchemaFactory.createForClass(PassageGroup);
