import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';
import { GeneratedAudioMetadata, GeneratedAudioMetadataSchema } from '../../../../common/media/generated-audio.schema.js';

export type PassageDocument = PgDocument<Passage>;

export class Passage {
  @PgField({
    type: PgId,
    ref: 'PassageGroup',
    required: true,
    index: true })
  passageGroupId: PgId;

  @PgField({
    required: true,
    enum: [
      'TEXT',
      'EMAIL',
      'ADVERTISEMENT',
      'ARTICLE',
      'NOTICE',
      'CHAT',
    ] })
  type:
    | 'TEXT'
    | 'EMAIL'
    | 'ADVERTISEMENT'
    | 'ARTICLE'
    | 'NOTICE'
    | 'CHAT';

  @PgField({
    trim: true })
  content?: string;

  @PgField({
    trim: true })
  audioUrl?: string;

  @PgField({ type: GeneratedAudioMetadataSchema, default: {} })
  audioMeta?: GeneratedAudioMetadata;

  @PgField({
    trim: true })
  imageUrl?: string;

  @PgField({
    default: 0,
    min: 0 })
  order: number;
}

export const PassageSchema = PgSchemaFactory.createForClass(Passage);