import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';

export type ArenaMatchQuestionDocument = PgDocument<ArenaMatchQuestion>;

export class ArenaQuestionOption {
  @PgField({ required: true })
  key: string;

  @PgField({ required: true })
  text: string;
}

export const ArenaQuestionOptionSchema =
  PgSchemaFactory.createForClass(ArenaQuestionOption);

/** Snapshot câu hỏi được cố định cho một trận để mọi client dùng cùng dữ liệu. */
export class ArenaMatchQuestion {
  @PgField({
    type: PgId,
    ref: 'ArenaMatch',
    required: true,
    index: true })
  matchId: PgId;

  @PgField({ type: PgId, ref: 'Word' })
  vocabularyId?: PgId;

  @PgField({ required: true, min: 0 })
  order: number;

  @PgField({
    type: String,
    enum: ['WORD_TO_MEANING', 'MEANING_TO_WORD', 'LISTENING', 'CONTEXT'],
    required: true })
  type: 'WORD_TO_MEANING' | 'MEANING_TO_WORD' | 'LISTENING' | 'CONTEXT';

  @PgField({ required: true })
  question: string;

  @PgField({ type: String })
  audioUrl?: string;

  @PgField({ type: String })
  imageUrl?: string;

  @PgField({ type: [ArenaQuestionOptionSchema], default: [] })
  options: ArenaQuestionOption[];

  @PgField({ required: true })
  correctAnswer: string;

  @PgField({ type: String })
  explanation?: string;

  @PgField({ type: String })
  example?: string;

  @PgField({ type: String })
  translation?: string;

  @PgField({ type: String })
  wordType?: string;

  @PgField({ type: Date })
  startedAt?: Date;

  @PgField({ type: Date, default: null })
  resolvedAt?: Date | null;

  @PgField({ type: PgId, ref: 'User', default: null })
  winnerId?: PgId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaMatchQuestionSchema =
  PgSchemaFactory.createForClass(ArenaMatchQuestion);
