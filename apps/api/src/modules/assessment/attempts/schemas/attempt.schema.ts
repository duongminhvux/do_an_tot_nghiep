import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { ExamMode, ToeicAttemptStatus } from '../attempt.types.js';
import type { SnapshotQuestion } from '../attempt.types.js';
import type { RawSectionResult } from '../attempt.types.js';

export type AttemptDocument = HydratedDocument<Attempt>;

@Schema({ timestamps: true, minimize: false })
export class Attempt {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  examId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed })
  examSnapshot?: { _id: string; name: string; slug: string };

  @Prop({ type: String, required: true, enum: Object.values(ExamMode) })
  mode: ExamMode;

  @Prop({
    type: [Number],
    required: true,
    validate: (parts: number[]) =>
      parts.length > 0 &&
      new Set(parts).size === parts.length &&
      parts.every((p) => Number.isInteger(p) && p >= 1 && p <= 7),
  })
  selectedParts: number[];

  // Freeze questions so exam edits cannot change an active attempt.
  @Prop({ type: [MongooseSchema.Types.Mixed], select: false, required: true })
  questionSnapshot: SnapshotQuestion[];

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  answers: Record<string, string>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  audioPlayCounts: Record<string, number>;

  @Prop({ type: [String], default: [] })
  flaggedQuestions: string[];

  @Prop({ default: 0, min: 0 })
  currentQuestionIndex: number;

  @Prop({ type: MongooseSchema.Types.Mixed })
  partResults?: (RawSectionResult & { part: number })[];

  @Prop({ type: MongooseSchema.Types.Mixed })
  listeningResult?: RawSectionResult;

  @Prop({ type: MongooseSchema.Types.Mixed })
  readingResult?: RawSectionResult;

  @Prop() resultVersion?: number;
  @Prop() totalCorrect?: number;
  @Prop() incorrectAnswers?: number;
  @Prop() unansweredQuestions?: number;
  @Prop() listeningCorrect?: number;
  @Prop() readingCorrect?: number;
  @Prop() accuracy?: number;
  @Prop() durationSpent?: number;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(ToeicAttemptStatus),
    default: 'IN_PROGRESS',
  })
  status: 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED' | 'COMPLETED';

  @Prop({
    type: Date,
    required: true,
  })
  startedAt: Date;

  @Prop()
  completedAt?: Date;

  // Full-test (TEST) mode only: answers are refused after this moment.
  @Prop()
  expiresAt?: Date;

  @Prop()
  timeLimitSeconds?: number;

  @Prop()
  submittedAt?: Date;

  @Prop({
    default: 0,
    min: 0,
  })
  totalQuestions: number;

  @Prop({
    default: 0,
    min: 0,
  })
  answeredQuestions: number;

  @Prop({
    default: 0,
    min: 0,
  })
  correctAnswers: number;

  @Prop({
    min: 0,
  })
  score?: number;
}

export const AttemptSchema = SchemaFactory.createForClass(Attempt);
AttemptSchema.index({ userId: 1, status: 1, createdAt: -1 });
AttemptSchema.index({ examId: 1, status: 1, createdAt: -1 });
AttemptSchema.index({ userId: 1, createdAt: -1 });
