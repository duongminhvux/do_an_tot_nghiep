import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';
import { GeneratedAudioMetadata, GeneratedAudioMetadataSchema } from '../../../../common/media/generated-audio.schema.js';

export type QuestionDocument = PgDocument<Question>;

@PgEntity({ timestamps: true })
export class Question {
  @PgField({
    type: PgId,
    ref: 'Exam',
    required: true,
    index: true })
  examId: PgId;

  @PgField({
    type: PgId,
    ref: 'PassageGroup',
    index: true })
  passageGroupId?: PgId;

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
    required: function (this: any) {
      return !([6, 7].includes(this.get('part')) && /^https?:\/\//i.test(this.get('imageUrl') || ''));
    },
    default: '',
    trim: true })
  content: string;

  @PgField({
    type: [
      {
        key: {
          type: String,
          enum: ['A', 'B', 'C', 'D'],
          required: true },
        text: {
          type: String,
          default: '',
          trim: true } },
    ],
    required: true,
    validate: {
      validator: function (this: any, options: Array<{ text?: string }>) {
        return [1, 2].includes(this.get('part')) || options.every((option) => Boolean(option.text?.trim()));
      },
      message: 'Part 3–7 requires text for every answer option.' } })
  options: {
    key: 'A' | 'B' | 'C' | 'D';
    text: string;
  }[];

  @PgField({
    required: true,
    enum: ['A', 'B', 'C', 'D'] })
  correctAnswer: 'A' | 'B' | 'C' | 'D';

  @PgField({
    trim: true })
  explanation?: string;

  @PgField({ trim: true })
  imageUrl?: string;

  @PgField({ trim: true })
  audioUrl?: string;

  @PgField({ type: GeneratedAudioMetadataSchema, default: {} })
  audioMeta?: GeneratedAudioMetadata;

  @PgField({ trim: true })
  importBatchId?: string;

  @PgField()
  importIndex?: number;

  @PgField()
  importFingerprint?: string;

  @PgField()
  sourceOrder?: number;

  @PgField({
    default: 0,
    min: 0 })
  order: number;

  @PgField({
    default: true })
  isActive: boolean;
}

export const QuestionSchema = PgSchemaFactory.createForClass(Question);
QuestionSchema.index(
  { examId: 1, importBatchId: 1, importIndex: 1 },
  { unique: true, partialFilterExpression: { importBatchId: { $type: 'string' } } },
);
