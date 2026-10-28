import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { DictationTopic } from './dictation-topic.schema.js';
import { DictationSection } from './dictation-section.schema.js';

export type DictationLessonDocument = PgDocument<DictationLesson>;

export enum DictationLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2' }

export enum DictationStatus {
  DRAFT = 'DRAFT',
  PROCESSING_AUDIO = 'PROCESSING_AUDIO',
  READY = 'READY',
  PUBLISHED = 'PUBLISHED',
  AUDIO_FAILED = 'AUDIO_FAILED',
  ARCHIVED = 'ARCHIVED' }

export enum DictationAudioSource {
  TTS = 'TTS',
  UPLOAD = 'UPLOAD' }

export class DictationLesson {
  @PgField({default:'DRAFT'}) publicationStatus: string;
  @PgField({default:1}) publicationRevision: number;
  @PgField({type:Object}) publicationValidation?: Record<string,unknown>;
  @PgField({ required: true, trim: true })
  title!: string;

  @PgField({ required: true, trim: true })
  slug!: string;

  @PgField({ trim: true, default: '' })
  description!: string;

  @PgField({ enum: DictationLevel, default: DictationLevel.B1, index: true })
  level!: DictationLevel;

  // Legacy/denormalized label kept for old data and fast display.
  @PgField({ trim: true, default: 'General', index: true })
  topic!: string;

  @PgField({ type: PgId, ref: DictationTopic.name, index: true })
  topicId?: PgId;

  @PgField({ type: PgId, ref: DictationSection.name, index: true })
  sectionId?: PgId;

  @PgField({ default: 0, index: true })
  order!: number;

  @PgField({ trim: true, default: '' })
  thumbnailUrl!: string;

  @PgField({ enum: DictationAudioSource, default: DictationAudioSource.TTS, index: true })
  audioSource!: DictationAudioSource;

  // Canonical transcript. For TTS this is admin input. For uploaded audio it is
  // filled by Faster Whisper, then can be reviewed/edited by the admin.
  @PgField({ trim: true, default: '' })
  sourceText!: string;

  @PgField({ enum: ['en-US', 'en-GB'], default: 'en-US' })
  language!: 'en-US' | 'en-GB';

  @PgField({ type: [String], default: ['af_heart'] })
  voiceIds!: string[];

  @PgField({ default: 1, min: 0.5, max: 2 })
  speed!: number;

  @PgField({ default: 300, min: 0, max: 10_000 })
  pauseAfterMs!: number;

  @PgField({ enum: DictationStatus, default: DictationStatus.DRAFT, index: true })
  status!: DictationStatus;

  @PgField({ default: 0 })
  sentenceCount!: number;

  @PgField({ default: 0 })
  totalDurationMs!: number;

  // Exactly one persisted lesson audio file for both TTS and uploaded-audio flows.
  @PgField({ trim: true, default: '' })
  fullAudioUrl!: string;

  @PgField({ trim: true, default: '' })
  fullAudioStorageKey!: string;

  @PgField({ trim: true, default: '' })
  fullAudioPublicId!: string;

  @PgField({ trim: true, default: '' })
  processingError!: string;

  @PgField({ trim: true, default: '' })
  audioProcessor!: string;

  @PgField({ trim: true, default: '' })
  audioProcessorDevice!: string;

  @PgField({ default: false })
  isDeleted!: boolean;

  @PgField()
  publishedAt?: Date;
}

export const DictationLessonSchema = PgSchemaFactory.createForClass(DictationLesson);
