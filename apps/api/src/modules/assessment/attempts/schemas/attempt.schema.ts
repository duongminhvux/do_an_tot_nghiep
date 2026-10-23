import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument,  PgSchemaDefinition } from '../../../../postgres/compat.js';
import { ExamMode, ToeicAttemptStatus } from '../attempt.types.js';
import type { SnapshotQuestion } from '../attempt.types.js';
import type { RawSectionResult } from '../attempt.types.js';

export type AttemptDocument = PgDocument<Attempt>;

@PgEntity({ timestamps: true, minimize: false })
export class Attempt {
  @PgField({
    type: PgId,
    ref: 'User',
    required: true,
    index: true })
  userId: PgId;

  @PgField({
    type: PgId,
    ref: 'Exam',
    required: true,
    index: true })
  examId: PgId;

  @PgField({ type: PgSchemaDefinition.Types.Mixed })
  examSnapshot?: { _id: string; name: string; slug: string };

  @PgField({ type: String, required: true, enum: Object.values(ExamMode) })
  mode: ExamMode;

  @PgField({
    type: [Number],
    required: true,
    validate: (parts: number[]) =>
      parts.length > 0 &&
      new Set(parts).size === parts.length &&
      parts.every((p) => Number.isInteger(p) && p >= 1 && p <= 7) })
  selectedParts: number[];

  // Freeze questions so exam edits cannot change an active attempt.
  @PgField({ type: [PgSchemaDefinition.Types.Mixed], select: false, required: true })
  questionSnapshot: SnapshotQuestion[];

  @PgField({ type: PgSchemaDefinition.Types.Mixed, default: {} })
  answers: Record<string, string>;

  // Missing on legacy attempts: preserve the service fallback to previously saved answers.
  @PgField({ type: PgSchemaDefinition.Types.Mixed })
  revealedAnswers?: Record<string, string>;

  @PgField({ type: PgSchemaDefinition.Types.Mixed, default: {} })
  audioPlayCounts: Record<string, number>;

  @PgField({ type: [String], default: [] })
  flaggedQuestions: string[];

  @PgField({ default: 0, min: 0 })
  currentQuestionIndex: number;

  @PgField({ type: PgSchemaDefinition.Types.Mixed })
  partResults?: (RawSectionResult & { part: number })[];

  @PgField({ type: PgSchemaDefinition.Types.Mixed })
  listeningResult?: RawSectionResult;

  @PgField({ type: PgSchemaDefinition.Types.Mixed })
  readingResult?: RawSectionResult;

  @PgField() resultVersion?: number;
  @PgField() totalCorrect?: number;
  @PgField() incorrectAnswers?: number;
  @PgField() unansweredQuestions?: number;
  @PgField() listeningCorrect?: number;
  @PgField() readingCorrect?: number;
  @PgField() accuracy?: number;
  @PgField() durationSpent?: number;

  @PgField({
    required: true,
    type: String,
    // Legacy .dump attempts may contain COMPLETED; current submissions use FINISHED.
    enum: [...Object.values(ToeicAttemptStatus), 'COMPLETED'],
    default: 'IN_PROGRESS' })
  status: ToeicAttemptStatus | 'COMPLETED';

  @PgField({
    type: Date,
    required: true })
  startedAt: Date;

  @PgField()
  completedAt?: Date;

  // Full-test (TEST) mode only: answers are refused after this moment.
  @PgField()
  expiresAt?: Date;

  @PgField()
  timeLimitSeconds?: number;

  @PgField()
  submittedAt?: Date;

  @PgField({
    default: 0,
    min: 0 })
  totalQuestions: number;

  @PgField({
    default: 0,
    min: 0 })
  answeredQuestions: number;

  @PgField({
    default: 0,
    min: 0 })
  correctAnswers: number;

  @PgField({
    min: 0 })
  score?: number;
}

export const AttemptSchema = PgSchemaFactory.createForClass(Attempt);
AttemptSchema.index({ userId: 1, status: 1, createdAt: -1 });
AttemptSchema.index({ examId: 1, status: 1, createdAt: -1 });
AttemptSchema.index({ userId: 1, createdAt: -1 });
