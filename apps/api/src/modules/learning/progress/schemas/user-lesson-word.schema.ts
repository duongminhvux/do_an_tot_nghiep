import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type UserLessonWordDocument = PgDocument<UserLessonWord>;

@PgEntity({ timestamps: true })
export class UserLessonWord {
  @PgField({
    type: PgId,
    ref: 'User',
    required: true,
    index: true })
  userId: PgId;

  @PgField({
    type: PgId,
    ref: 'LessonWord',
    required: true,
    index: true })
  lessonWordId: PgId;

  @PgField()
  learnedAt?: Date;

  @PgField()
  completedAt?: Date;
}

export const UserLessonWordSchema =
  PgSchemaFactory.createForClass(UserLessonWord);

UserLessonWordSchema.index(
  { userId: 1, lessonWordId: 1 },
  { unique: true },
);