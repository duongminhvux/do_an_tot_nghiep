import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { DictationLesson } from './dictation-lesson.schema.js';

export type DictationSegmentDocument = PgDocument<DictationSegment>;

@PgEntity({ _id: false })
export class DictationWordTiming {
  @PgField({ required: true })
  word!: string;

  @PgField({ required: true, min: 0 })
  startMs!: number;

  @PgField({ required: true, min: 0 })
  endMs!: number;

  @PgField({ default: 0, min: 0, max: 1 })
  probability!: number;
}

const DictationWordTimingSchema = PgSchemaFactory.createForClass(DictationWordTiming);

@PgEntity({ timestamps: true })
export class DictationSegment {
  @PgField({ type: PgId, ref: DictationLesson.name, required: true, index: true })
  lessonId!: PgId;

  @PgField({ required: true, min: 0 })
  order!: number;

  @PgField({ required: true, trim: true })
  text!: string;

  @PgField({ trim: true, default: '' })
  normalizedText!: string;

  @PgField({ enum: ['TTS', 'ASR'], required: true })
  source!: 'TTS' | 'ASR';

  @PgField({ trim: true, default: '' })
  speaker!: string;

  @PgField({ trim: true, default: '' })
  voiceId!: string;

  @PgField({ enum: ['en-US', 'en-GB'], required: true })
  language!: 'en-US' | 'en-GB';

  @PgField({ default: 1, min: 0.5, max: 2 })
  speed!: number;

  // Unified playback metadata. The frontend always seeks the lesson-level audio
  // to startMs and pauses at endMs; no sentence audio file is required.
  @PgField({ required: true, min: 0 })
  startMs!: number;

  @PgField({ required: true, min: 0 })
  endMs!: number;

  @PgField({ required: true, min: 0 })
  durationMs!: number;

  @PgField({ default: 0, min: 0, max: 1 })
  confidence!: number;

  @PgField({ type: [DictationWordTimingSchema], default: [] })
  words!: DictationWordTiming[];

  // Legacy fields kept temporarily so old Dictation records can be cleaned up
  // when regenerated. New records do not persist per-segment media.
  @PgField({ trim: true, default: '' })
  audioUrl?: string;

  @PgField({ trim: true, default: '' })
  audioPublicId?: string;
}

export const DictationSegmentSchema = PgSchemaFactory.createForClass(DictationSegment);
DictationSegmentSchema.index({ lessonId: 1, order: 1 }, { unique: true });
