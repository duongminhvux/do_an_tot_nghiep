import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type UserDailyActivityDocument = PgDocument<UserDailyActivity>;

@PgEntity({ timestamps: true })
export class UserDailyActivity {
  @PgField({
    type: PgId,
    ref: 'User',
    required: true,
    index: true })
  userId: PgId;

  @PgField({
    type: Date,
    required: true })
  date: Date; // Chuẩn hóa về 00:00:00.000Z của ngày

  @PgField({
    type: Number,
    default: 0 })
  studyMinutes: number;

  @PgField({
    type: Number,
    default: 0 })
  wordsLearned: number;

  @PgField({
    type: Number,
    default: 0 })
  wordsReviewed: number;

  @PgField({
    type: Number,
    default: 0 })
  sessionCount: number;
}

export const UserDailyActivitySchema =
  PgSchemaFactory.createForClass(UserDailyActivity);

UserDailyActivitySchema.index({ userId: 1, date: 1 }, { unique: true });
