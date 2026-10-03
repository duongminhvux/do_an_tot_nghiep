import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DictationLessonDocument = HydratedDocument<DictationLesson>;

export enum DictationLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export enum DictationStatus {
  DRAFT = 'DRAFT',
  PROCESSING_AUDIO = 'PROCESSING_AUDIO',
  READY = 'READY',
  PUBLISHED = 'PUBLISHED',
  AUDIO_FAILED = 'AUDIO_FAILED',
  ARCHIVED = 'ARCHIVED',
}

@Schema({ timestamps: true })
export class DictationLesson {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true, index: true })
  slug!: string;

  @Prop({ trim: true, default: '' })
  description!: string;

  @Prop({ enum: DictationLevel, default: DictationLevel.B1, index: true })
  level!: DictationLevel;

  @Prop({ trim: true, default: 'General', index: true })
  topic!: string;

  @Prop({ trim: true, default: '' })
  thumbnailUrl!: string;

  @Prop({ required: true, trim: true })
  sourceText!: string;

  @Prop({ enum: ['en-US', 'en-GB'], default: 'en-US' })
  language!: 'en-US' | 'en-GB';

  @Prop({ type: [String], default: ['af_heart'] })
  voiceIds!: string[];

  @Prop({ default: 1, min: 0.5, max: 2 })
  speed!: number;

  @Prop({ default: 300, min: 0, max: 10_000 })
  pauseAfterMs!: number;

  @Prop({ enum: DictationStatus, default: DictationStatus.DRAFT, index: true })
  status!: DictationStatus;

  @Prop({ default: 0 })
  sentenceCount!: number;

  @Prop({ default: 0 })
  totalDurationMs!: number;

  @Prop({ trim: true, default: '' })
  fullAudioUrl!: string;

  @Prop({ trim: true, default: '' })
  fullAudioPublicId!: string;

  @Prop({ trim: true, default: '' })
  processingError!: string;

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop()
  publishedAt?: Date;
}

export const DictationLessonSchema = SchemaFactory.createForClass(DictationLesson);

DictationLessonSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } },
);
