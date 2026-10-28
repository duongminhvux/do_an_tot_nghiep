import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type UserWordReviewDocument = PgDocument<UserWordReview>;

export class Review {}

export class UserWordReview {
  @PgField({
    type: PgId,
    ref: 'User',
    required: true,
    index: true })
  userId: PgId;

  @PgField({
    type: PgId,
    ref: 'Word',
    required: true,
    index: true })
  wordId: PgId;

  @PgField({
    type: String,
    enum: ['LEARNING', 'MASTERED'],
    default: 'LEARNING' })
  status: 'LEARNING' | 'MASTERED';

  @PgField({
    type: Number,
    default: 0 })
  reviewCount: number;

  @PgField({
    type: Number,
    default: 0 })
  correctCount: number;

  @PgField({
    type: Number,
    default: 0 })
  incorrectCount: number;

  @PgField({
    type: Number,
    default: 0 })
  intervalDays: number;

  @PgField()
  lastReviewedAt?: Date;

  @PgField()
  nextReviewAt?: Date;
}

export const UserWordReviewSchema =
  PgSchemaFactory.createForClass(UserWordReview);