import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DictationLesson } from './dictation-lesson.schema.js';

export type DictationSegmentDocument = HydratedDocument<DictationSegment>;

@Schema({ timestamps: true })
export class DictationSegment {
  @Prop({ type: Types.ObjectId, ref: DictationLesson.name, required: true, index: true })
  lessonId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  order!: number;

  @Prop({ required: true, trim: true })
  text!: string;

  @Prop({ required: true, trim: true })
  voiceId!: string;

  @Prop({ enum: ['en-US', 'en-GB'], required: true })
  language!: 'en-US' | 'en-GB';

  @Prop({ default: 1, min: 0.5, max: 2 })
  speed!: number;

  @Prop({ trim: true, default: '' })
  audioUrl!: string;

  @Prop({ trim: true, default: '' })
  audioPublicId!: string;

  @Prop({ default: 0 })
  durationMs!: number;
}

export const DictationSegmentSchema = SchemaFactory.createForClass(DictationSegment);
DictationSegmentSchema.index({ lessonId: 1, order: 1 }, { unique: true });
