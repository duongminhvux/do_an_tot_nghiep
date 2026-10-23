import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import type { PgDocument } from '../../../postgres/compat.js';
import { GeneratedAudioMetadata, GeneratedAudioMetadataSchema } from '../../../common/media/generated-audio.schema.js';

export type WordDocument = PgDocument<Word>;

/**
 * IPA
 */
@PgEntity({ _id: false })
export class WordIpa {
  @PgField()
  us?: string;

  @PgField()
  uk?: string;
}

export const WordIpaSchema = PgSchemaFactory.createForClass(WordIpa);

/**
 * Audio
 */
@PgEntity({ _id: false })
export class WordAudio {
  @PgField()
  us?: string;

  @PgField()
  uk?: string;
}

export const WordAudioSchema = PgSchemaFactory.createForClass(WordAudio);
@PgEntity({ _id: false })
export class WordAudioMetadata {
  @PgField({ type: GeneratedAudioMetadataSchema, default: {} })
  us?: GeneratedAudioMetadata;

  @PgField({ type: GeneratedAudioMetadataSchema, default: {} })
  uk?: GeneratedAudioMetadata;
}

export const WordAudioMetadataSchema = PgSchemaFactory.createForClass(WordAudioMetadata);


/**
 * Example
 */
@PgEntity({ _id: false })
export class WordExample {
  @PgField({ default: '' })
  en?: string;

  @PgField({ default: '' })
  vi?: string;
}

export const WordExampleSchema = PgSchemaFactory.createForClass(WordExample);

/**
 * Meaning
 */
@PgEntity({ _id: false })
export class WordMeaning {
  @PgField({ default: '' })
  definition?: string;

  @PgField({ type: [String], default: [] })
  translation: string[];

  @PgField({ type: [String], default: [] })
  synonyms: string[];

  @PgField({ type: [String], default: [] })
  antonyms: string[];

  @PgField({
    type: [WordExampleSchema],
    default: [] })
  examples: WordExample[];
}

export const WordMeaningSchema = PgSchemaFactory.createForClass(WordMeaning);

/**
 * Part of speech
 */
@PgEntity({ _id: false })
export class WordPart {
  @PgField({ required: true })
  partOfSpeech: string;

  @PgField({
    type: [WordMeaningSchema],
    default: [] })
  meanings: WordMeaning[];
}

export const WordPartSchema = PgSchemaFactory.createForClass(WordPart);

/**
 * Word
 */
@PgEntity({
  timestamps: true })
export class Word {
  @PgField({
    required: true,
    trim: true,
    unique: true,
    index: true })
  word: string;

  @PgField({
    required: true,
    trim: true,
    unique: true,
    index: true })
  slug: string;

  @PgField({
    required: true,
    uppercase: true,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    index: true })
  level: string;

  @PgField({
    type: WordIpaSchema,
    default: {} })
  ipa: WordIpa;

  @PgField({
    type: WordAudioSchema,
    default: {} })
  audio: WordAudio;

  @PgField({ type: WordAudioMetadataSchema, default: {} })
  audioMeta: WordAudioMetadata;

  @PgField()
  image?: string;

  @PgField({
    type: [String],
    default: [] })
  variations: string[];

  @PgField({
    type: [String],
    default: [] })
  relatedWords: string[];

  @PgField({
    type: [WordPartSchema],
    default: [] })
  parts: WordPart[];

  @PgField({ default: true })
  isActive: boolean;

  @PgField({ default: false, index: true })
  isDeleted: boolean;
}

export const WordSchema = PgSchemaFactory.createForClass(Word);