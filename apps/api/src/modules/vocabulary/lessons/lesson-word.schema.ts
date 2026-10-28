import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { Lesson } from './lesson.schema.js';
import { Word } from '../words/word.schema.js';
import { Section } from './section.schema.js';

export type LessonWordDocument = PgDocument<LessonWord>;

export class LessonWord {
  @PgField({ type: PgId, ref: Lesson.name, required: true, index: true })
  lessonId!: PgId;

  @PgField({ type: PgId, ref: Word.name, required: true, index: true })
  wordId!: PgId;

  @PgField({ type: PgId, ref: Section.name, required: false, index: true })
  sectionId?: PgId;

  @PgField({ default: 0 })
  order?: number;

  @PgField({ trim: true })
  customNote?: string;
}

export const LessonWordSchema = PgSchemaFactory.createForClass(LessonWord);

