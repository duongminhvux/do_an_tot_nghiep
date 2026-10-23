import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type AttemptAnswerDocument = PgDocument<AttemptAnswer>;

@PgEntity({ timestamps: true })
export class AttemptAnswer {
  @PgField({
    type: PgId,
    ref: 'Attempt',
    required: true,
    index: true })
  attemptId: PgId;

  @PgField({
    type: PgId,
    ref: 'Question',
    required: true,
    index: true })
  questionId: PgId;

  @PgField({
    enum: ['A', 'B', 'C', 'D'] })
  selectedAnswer?: 'A' | 'B' | 'C' | 'D';

  @PgField({
    default: false })
  isCorrect: boolean;

  @PgField()
  answeredAt?: Date;
}

export const AttemptAnswerSchema = PgSchemaFactory.createForClass(AttemptAnswer);

AttemptAnswerSchema.index(
  {
    attemptId: 1,
    questionId: 1 },
  {
    unique: true },
);
