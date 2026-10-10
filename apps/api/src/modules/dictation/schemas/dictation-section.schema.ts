import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DictationTopic } from './dictation-topic.schema.js';

export type DictationSectionDocument = HydratedDocument<DictationSection>;

@Schema({ timestamps: true })
export class DictationSection {
  @Prop({ type: Types.ObjectId, ref: DictationTopic.name, required: true, index: true })
  topicId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  slug!: string;

  @Prop({ trim: true, default: '' })
  description!: string;

  @Prop({ default: 0, index: true })
  order!: number;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ default: false })
  isDeleted!: boolean;
}

export const DictationSectionSchema = SchemaFactory.createForClass(DictationSection);
DictationSectionSchema.index(
  { topicId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
DictationSectionSchema.index({ topicId: 1, order: 1 });
