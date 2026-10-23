import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type LearningSessionWordDocument =
  PgDocument<LearningSessionWord>;

@PgEntity({ timestamps: true })
export class LearningSessionWord {
  @PgField({
    type: PgId,
    ref: 'LearningSession',
    required: true,
    index: true })
  sessionId: PgId;

  @PgField({
    type: PgId,
    ref: 'Word',
    required: true,
    index: true })
  wordId: PgId;

  @PgField({
    type: PgId,
    ref: 'LessonWord' })
  lessonWordId?: PgId;

  @PgField({
    type: String,
    enum: ['FLASHCARD', 'MULTIPLE_CHOICE', 'TYPING'],
    required: true })
  mode: 'FLASHCARD' | 'MULTIPLE_CHOICE' | 'TYPING';

  @PgField({
    type: String,
    enum: ['AGAIN', 'HARD', 'GOOD', 'EASY'] })
  rating?: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

  @PgField()
  isCorrect?: boolean;

  @PgField({
    type: Date,
    required: true })
  answeredAt: Date;

  @PgField()
  scheduledAt?: Date;
}

export const LearningSessionWordSchema =
  PgSchemaFactory.createForClass(LearningSessionWord);