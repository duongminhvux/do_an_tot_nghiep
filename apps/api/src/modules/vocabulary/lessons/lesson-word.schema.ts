import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Lesson } from './lesson.schema.js';
import { Word } from '../words/word.schema.js';

export type LessonWordDocument = HydratedDocument<LessonWord>;

@Schema({ timestamps: true })
export class LessonWord {
  @Prop({ type: Types.ObjectId, ref: Lesson.name, required: true, index: true })
  lessonId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Word.name, required: true, index: true })
  wordId!: Types.ObjectId;

  @Prop({ default: 0 })
  order?: number;

  @Prop({ trim: true })
  customNote?: string;
}

export const LessonWordSchema = SchemaFactory.createForClass(LessonWord);
LessonWordSchema.index({ lessonId: 1, wordId: 1 }, { unique: true });
