import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type PassageGroupDocument = PgDocument<PassageGroup>;

export class PassageGroup {
  @PgField({
    type: PgId,
    ref: 'Exam',
    required: true,
    index: true })
  examId: PgId;

  @PgField({
    required: true,
    enum: ['LISTENING', 'READING'] })
  section: 'LISTENING' | 'READING';

  @PgField({
    required: true,
    min: 1,
    max: 7 })
  part: number;

  @PgField({
    trim: true })
  title?: string;

  @PgField({
    default: 0,
    min: 0 })
  order: number;
}

export const PassageGroupSchema =
  PgSchemaFactory.createForClass(PassageGroup);
