import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';
import { GeneratedAudioMetadata, GeneratedAudioMetadataSchema } from '../../../../common/media/generated-audio.schema.js';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ timestamps: true })
export class Question {
  @Prop({
    type: Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  })
  examId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'PassageGroup',
    index: true,
  })
  passageGroupId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['LISTENING', 'READING'],
  })
  section: 'LISTENING' | 'READING';

  @Prop({
    required: true,
    min: 1,
    max: 7,
  })
  part: number;

  @Prop({
    required: function (this: any) {
      return !([6, 7].includes(this.get('part')) && /^https?:\/\//i.test(this.get('imageUrl') || ''));
    },
    default: '',
    trim: true,
  })
  content: string;

  @Prop({
    type: [
      {
        key: {
          type: String,
          enum: ['A', 'B', 'C', 'D'],
          required: true,
        },
        text: {
          type: String,
          default: '',
          trim: true,
        },
      },
    ],
    required: true,
    validate: {
      validator: function (this: any, options: Array<{ text?: string }>) {
        return [1, 2].includes(this.get('part')) || options.every((option) => Boolean(option.text?.trim()));
      },
      message: 'Part 3–7 requires text for every answer option.',
    },
  })
  options: {
    key: 'A' | 'B' | 'C' | 'D';
    text: string;
  }[];

  @Prop({
    required: true,
    enum: ['A', 'B', 'C', 'D'],
  })
  correctAnswer: 'A' | 'B' | 'C' | 'D';

  @Prop({
    trim: true,
  })
  explanation?: string;

  @Prop({ trim: true })
  imageUrl?: string;

  @Prop({ trim: true })
  audioUrl?: string;

  @Prop({ type: GeneratedAudioMetadataSchema, default: {} })
  audioMeta?: GeneratedAudioMetadata;

  @Prop({ trim: true })
  importBatchId?: string;

  @Prop()
  importIndex?: number;

  @Prop()
  importFingerprint?: string;

  @Prop()
  sourceOrder?: number;

  @Prop({
    default: 0,
    min: 0,
  })
  order: number;

  @Prop({
    default: true,
  })
  isActive: boolean;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.index(
  { examId: 1, importBatchId: 1, importIndex: 1 },
  { unique: true, partialFilterExpression: { importBatchId: { $type: 'string' } } },
);
