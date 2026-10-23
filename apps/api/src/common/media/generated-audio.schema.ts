import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum AudioSourceType {
  TTS = 'TTS',
  UPLOAD = 'UPLOAD',
}

export enum AudioGenerationStatus {
  NONE = 'NONE',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  STALE = 'STALE',
  FAILED = 'FAILED',
}

@Schema({ _id: false })
export class AudioSegmentMetadata {
  @Prop({ trim: true, default: '' })
  text?: string;

  @Prop({ trim: true, default: '' })
  speaker?: string;

  @Prop({ trim: true, default: '' })
  voiceId?: string;

  @Prop({ default: 0, min: 0 })
  startMs!: number;

  @Prop({ default: 0, min: 0 })
  endMs!: number;
}

export const AudioSegmentMetadataSchema = SchemaFactory.createForClass(AudioSegmentMetadata);

@Schema({ _id: false })
export class GeneratedAudioMetadata {
  @Prop({ type: String, enum: Object.values(AudioSourceType), default: AudioSourceType.TTS })
  source!: AudioSourceType;

  @Prop({ type: String, enum: Object.values(AudioGenerationStatus), default: AudioGenerationStatus.NONE })
  status!: AudioGenerationStatus;

  @Prop({ trim: true, default: '' })
  storageKey?: string;

  @Prop({ trim: true, default: '' })
  provider?: string;

  @Prop({ trim: true, default: '' })
  device?: string;

  @Prop({ enum: ['en-US', 'en-GB'], default: 'en-US' })
  language?: 'en-US' | 'en-GB';

  @Prop({ type: [String], default: [] })
  voiceIds?: string[];

  @Prop({ default: 1, min: 0.5, max: 2 })
  speed?: number;

  @Prop({ default: 0, min: 0 })
  durationMs?: number;

  @Prop({ trim: true, default: '' })
  scriptHash?: string;

  @Prop()
  generatedAt?: Date;

  @Prop({ trim: true, default: '' })
  error?: string;

  @Prop({ type: [AudioSegmentMetadataSchema], default: [] })
  segments?: AudioSegmentMetadata[];
}

export const GeneratedAudioMetadataSchema = SchemaFactory.createForClass(GeneratedAudioMetadata);
