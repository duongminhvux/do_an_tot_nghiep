import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

export type ArenaMatchQuestionDocument = HydratedDocument<ArenaMatchQuestion>;

@Schema({ _id: false })
export class ArenaQuestionOption {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  text: string;
}

export const ArenaQuestionOptionSchema =
  SchemaFactory.createForClass(ArenaQuestionOption);

@Schema({ timestamps: true })
/** Snapshot câu hỏi được cố định cho một trận để mọi client dùng cùng dữ liệu. */
export class ArenaMatchQuestion {
  @Prop({
    type: Types.ObjectId,
    ref: 'ArenaMatch',
    required: true,
    index: true,
  })
  matchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Word' })
  vocabularyId?: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  order: number;

  @Prop({
    type: String,
    enum: ['WORD_TO_MEANING', 'MEANING_TO_WORD', 'LISTENING', 'CONTEXT'],
    required: true,
  })
  type: 'WORD_TO_MEANING' | 'MEANING_TO_WORD' | 'LISTENING' | 'CONTEXT';

  @Prop({ required: true })
  question: string;

  @Prop({ type: String })
  audioUrl?: string;

  @Prop({ type: String })
  imageUrl?: string;

  @Prop({ type: [ArenaQuestionOptionSchema], default: [] })
  options: ArenaQuestionOption[];

  @Prop({ required: true })
  correctAnswer: string;

  @Prop({ type: String })
  explanation?: string;

  @Prop({ type: String })
  example?: string;

  @Prop({ type: String })
  translation?: string;

  @Prop({ type: String })
  wordType?: string;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date, default: null })
  resolvedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  winnerId?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ArenaMatchQuestionSchema =
  SchemaFactory.createForClass(ArenaMatchQuestion);
ArenaMatchQuestionSchema.index({ matchId: 1, order: 1 }, { unique: true });
