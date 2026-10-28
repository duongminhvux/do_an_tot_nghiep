import { PgField, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type ExamGroupDocument = PgDocument<ExamGroup>;

export class ExamGroup {
  @PgField({ required: true, trim: true })
  name: string;

  @PgField({ required: true, trim: true })
  slug: string;

  @PgField({ trim: true })
  description?: string;

  @PgField({ default: 0, min: 0 })
  order: number;

  @PgField({ default: true })
  isActive: boolean;

  @PgField({ default: false })
  isDeleted: boolean;
}

export const ExamGroupSchema = PgSchemaFactory.createForClass(ExamGroup);
