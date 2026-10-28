import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type UserLessonProgressDocument =
  PgDocument<UserLessonProgress>;

export class UserLessonProgress {
  @PgField({
    type: PgId,
    ref: 'User',
    required: true,
    index: true })
  userId: PgId;

  @PgField({
    type: PgId,
    ref: 'Lesson',
    required: true,
    index: true })
  lessonId: PgId;

  @PgField({
    type: String,
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
    default: 'NOT_STARTED' })
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

  @PgField({
    type: Number,
    default: 0,
    min: 0,
    max: 100 })
  progress: number;

  @PgField()
  startedAt?: Date;

  @PgField()
  lastStudiedAt?: Date;

  @PgField()
  completedAt?: Date;
}

export const UserLessonProgressSchema =
  PgSchemaFactory.createForClass(UserLessonProgress);