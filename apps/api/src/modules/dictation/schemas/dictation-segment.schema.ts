import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DictationLesson } from './dictation-lesson.schema.js';

export type DictationSegmentDocument = HydratedDocument<DictationSegment>;

@Schema({ _id: false })
export class DictationWordTiming {
  @Prop({ required: true })
  word!: string;

  @Prop({ required: true, min: 0 })
  startMs!: number;

  @Prop({ required: true, min: 0 })
  endMs!: number;

  @Prop({ default: 0, min: 0, max: 1 })
  probability!: number;
}

const DictationWordTimingSchema = SchemaFactory.createForClass(DictationWordTiming);

@Schema({ timestamps: true })
export class DictationSegment {
  @Prop({ type: Types.ObjectId, ref: DictationLesson.name, required: true, index: true })
  lessonId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  order!: number;

  @Prop({ required: true, trim: true })
  text!: string;

  @Prop({ trim: true, default: '' })
  normalizedText!: string;

  @Prop({ enum: ['TTS', 'ASR'], required: true })
  source!: 'TTS' | 'ASR';

  @Prop({ trim: true, default: '' })
  speaker!: string;

  @Prop({ trim: true, default: '' })
  voiceId!: string;

  @Prop({ enum: ['en-US', 'en-GB'], required: true })
  language!: 'en-US' | 'en-GB';

  @Prop({ default: 1, min: 0.5, max: 2 })
  speed!: number;

  // Unified playback metadata. The frontend always seeks the lesson-level audio
  // to startMs and pauses at endMs; no sentence audio file is required.
  @Prop({ required: true, min: 0 })
  startMs!: number;

  @Prop({ required: true, min: 0 })
  endMs!: number;

  @Prop({ required: true, min: 0 })
  durationMs!: number;

  @Prop({ default: 0, min: 0, max: 1 })
  confidence!: number;

  @Prop({ type: [DictationWordTimingSchema], default: [] })
  words!: DictationWordTiming[];

  // Legacy fields kept temporarily so old Dictation records can be cleaned up
  // when regenerated. New records do not persist per-segment media.
  @Prop({ trim: true, default: '' })
  audioUrl?: string;

  @Prop({ trim: true, default: '' })
  audioPublicId?: string;
}

export const DictationSegmentSchema = SchemaFactory.createForClass(DictationSegment);
DictationSegmentSchema.index({ lessonId: 1, order: 1 }, { unique: true });
