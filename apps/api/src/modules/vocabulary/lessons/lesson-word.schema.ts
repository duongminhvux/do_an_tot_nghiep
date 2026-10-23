import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { Lesson } from './lesson.schema.js';
import { Word } from '../words/word.schema.js';
import { Section } from './section.schema.js';

export type LessonWordDocument = PgDocument<LessonWord>;

@PgEntity({ timestamps: true })
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
LessonWordSchema.index({ lessonId: 1, wordId: 1 }, { unique: true });
LessonWordSchema.index({ lessonId: 1, sectionId: 1, order: 1 });

