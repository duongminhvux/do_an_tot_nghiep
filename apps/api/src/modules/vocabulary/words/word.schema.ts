import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WordDocument = HydratedDocument<Word>;

/**
 * IPA
 */
@Schema({ _id: false })
export class WordIpa {
  @Prop()
  us?: string;

  @Prop()
  uk?: string;
}

export const WordIpaSchema = SchemaFactory.createForClass(WordIpa);

/**
 * Audio
 */
@Schema({ _id: false })
export class WordAudio {
  @Prop()
  us?: string;

  @Prop()
  uk?: string;
}

export const WordAudioSchema = SchemaFactory.createForClass(WordAudio);

/**
 * Example
 */
@Schema({ _id: false })
export class WordExample {
  @Prop({ default: '' })
  en?: string;

  @Prop({ default: '' })
  vi?: string;
}

export const WordExampleSchema = SchemaFactory.createForClass(WordExample);

/**
 * Meaning
 */
@Schema({ _id: false })
export class WordMeaning {
  @Prop({ default: '' })
  definition?: string;

  @Prop({ type: [String], default: [] })
  translation: string[];

  @Prop({ type: [String], default: [] })
  synonyms: string[];

  @Prop({ type: [String], default: [] })
  antonyms: string[];

  @Prop({
    type: [WordExampleSchema],
    default: [],
  })
  examples: WordExample[];
}

export const WordMeaningSchema = SchemaFactory.createForClass(WordMeaning);

/**
 * Part of speech
 */
@Schema({ _id: false })
export class WordPart {
  @Prop({ required: true })
  partOfSpeech: string;

  @Prop({
    type: [WordMeaningSchema],
    default: [],
  })
  meanings: WordMeaning[];
}

export const WordPartSchema = SchemaFactory.createForClass(WordPart);

/**
 * Word
 */
@Schema({
  timestamps: true,
})
export class Word {
  @Prop({
    required: true,
    trim: true,
    unique: true,
    index: true,
  })
  word: string;

  @Prop({
    required: true,
    trim: true,
    unique: true,
    index: true,
  })
  slug: string;

  @Prop({
    required: true,
    uppercase: true,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    index: true,
  })
  level: string;

  @Prop({
    type: WordIpaSchema,
    default: {},
  })
  ipa: WordIpa;

  @Prop({
    type: WordAudioSchema,
    default: {},
  })
  audio: WordAudio;

  @Prop()
  image?: string;

  @Prop({
    type: [String],
    default: [],
  })
  variations: string[];

  @Prop({
    type: [String],
    default: [],
  })
  relatedWords: string[];

  @Prop({
    type: [WordPartSchema],
    default: [],
  })
  parts: WordPart[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false, index: true })
  isDeleted: boolean;
}

export const WordSchema = SchemaFactory.createForClass(Word);