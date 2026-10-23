import { PgField, PgEntity, PgSchemaFactory } from '../../postgres/compat.js';

export enum AudioSourceType {
  TTS = 'TTS',
  UPLOAD = 'UPLOAD' }

export enum AudioGenerationStatus {
  NONE = 'NONE',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  STALE = 'STALE',
  FAILED = 'FAILED' }

@PgEntity({ _id: false })
export class AudioSegmentMetadata {
  @PgField({ trim: true, default: '' })
  text?: string;

  @PgField({ trim: true, default: '' })
  speaker?: string;

  @PgField({ trim: true, default: '' })
  voiceId?: string;

  @PgField({ default: 0, min: 0 })
  startMs!: number;

  @PgField({ default: 0, min: 0 })
  endMs!: number;
}

export const AudioSegmentMetadataSchema = PgSchemaFactory.createForClass(AudioSegmentMetadata);

@PgEntity({ _id: false })
export class GeneratedAudioMetadata {
  @PgField({ type: String, enum: Object.values(AudioSourceType), default: AudioSourceType.TTS })
  source!: AudioSourceType;

  @PgField({ type: String, enum: Object.values(AudioGenerationStatus), default: AudioGenerationStatus.NONE })
  status!: AudioGenerationStatus;

  @PgField({ trim: true, default: '' })
  storageKey?: string;

  @PgField({ trim: true, default: '' })
  provider?: string;

  @PgField({ trim: true, default: '' })
  device?: string;

  @PgField({ enum: ['en-US', 'en-GB'], default: 'en-US' })
  language?: 'en-US' | 'en-GB';

  @PgField({ type: [String], default: [] })
  voiceIds?: string[];

  @PgField({ default: 1, min: 0.5, max: 2 })
  speed?: number;

  @PgField({ default: 0, min: 0 })
  durationMs?: number;

  @PgField({ trim: true, default: '' })
  scriptHash?: string;

  @PgField()
  generatedAt?: Date;

  @PgField({ trim: true, default: '' })
  error?: string;

  @PgField({ type: [AudioSegmentMetadataSchema], default: [] })
  segments?: AudioSegmentMetadata[];
}

export const GeneratedAudioMetadataSchema = PgSchemaFactory.createForClass(GeneratedAudioMetadata);
