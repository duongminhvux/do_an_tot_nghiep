import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type LearningSessionDocument = PgDocument<LearningSession>;

export class Session {}

export class LearningSession {
  @PgField({
    type: PgId,
    ref: 'User',
    required: true,
    index: true })
  userId: PgId;

  @PgField({
    type: String,
    enum: ['LESSON', 'REVIEW'],
    required: true })
  type: 'LESSON' | 'REVIEW';

  @PgField({
    type: PgId,
    ref: 'Lesson' })
  lessonId?: PgId;

  @PgField({
    type: Date,
    required: true })
  startedAt: Date;

  @PgField()
  endedAt?: Date;

  @PgField({
    type: Number,
    default: 0 })
  durationSeconds?: number;

  @PgField({
    type: Number,
    default: 0 })
  totalWords: number;

  @PgField({
    type: Number,
    default: 0 })
  completedWords: number;
}

export const LearningSessionSchema =
  PgSchemaFactory.createForClass(LearningSession);