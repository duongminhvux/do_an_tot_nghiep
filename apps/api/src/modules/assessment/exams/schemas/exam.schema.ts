import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type ExamDocument = PgDocument<Exam>;

@PgEntity({ timestamps: true })
export class Exam {
  @PgField({default:'DRAFT'}) publicationStatus: string;
  @PgField({default:1}) publicationRevision: number;
  @PgField({type:Object}) publicationValidation?: Record<string,unknown>;
  @PgField({
    required: true,
    trim: true })
  name: string;

  @PgField({
    required: true,
    trim: true })
  slug: string;

  @PgField({
    required: true,
    enum: ['TOEIC', 'IELTS'] })
  type: 'TOEIC' | 'IELTS';

  @PgField({
    default: 0,
    min: 0 })
  totalQuestions?: number;

  @PgField({
    trim: true })
  description?: string;

  @PgField({
    default: 0,
    min: 0 })
  durationMinutes: number;

  @PgField({
    default: true })
  isActive: boolean;

  @PgField({
    default: 0,
    min: 0 })
  order: number;

  @PgField({
    type: PgId,
    ref: 'ExamGroup',
    default: null })
  groupId?: PgId | null;

  // Position inside `groupId` (1-based, set by admins via drag & drop).
  @PgField({ default: 0, min: 0 })
  groupOrder: number;

  @PgField({
    default: false })
  isDeleted: boolean;
}

export const ExamSchema = PgSchemaFactory.createForClass(Exam);

ExamSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
ExamSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
ExamSchema.index({ groupId: 1 });
ExamSchema.index({ groupId: 1, groupOrder: 1 });
