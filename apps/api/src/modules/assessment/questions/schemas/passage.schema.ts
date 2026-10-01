import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PassageDocument = HydratedDocument<Passage>;

@Schema({ timestamps: true })
export class Passage {
  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  examId: Types.ObjectId;

  @Prop({
    trim: true,
  })
  title?: string;

  @Prop({
    required: true,
    enum: ['LISTENING', 'READING'],
  })
  section: 'LISTENING' | 'READING';

  @Prop({
    trim: true,
  })
  content?: string;

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
}

export const PassageSchema = SchemaFactory.createForClass(Passage);