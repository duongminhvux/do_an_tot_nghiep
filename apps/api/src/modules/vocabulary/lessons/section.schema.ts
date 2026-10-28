import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { Lesson } from './lesson.schema.js';

export type SectionDocument = PgDocument<Section>;

export class Section {
  @PgField({ type: PgId, ref: Lesson.name, required: true, index: true })
  lessonId!: PgId;

  @PgField({ required: true, trim: true })
  name!: string;

  @PgField({ required: true, trim: true, index: true })
  slug!: string;

  @PgField({ default: 1 })
  order?: number;
}

export const SectionSchema = PgSchemaFactory.createForClass(Section);

