import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DictationTopicDocument = HydratedDocument<DictationTopic>;

@Schema({ timestamps: true })
export class DictationTopic {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true, index: true })
  slug!: string;

  @Prop({ trim: true, default: '' })
  description!: string;

  @Prop({ trim: true, default: '' })
  thumbnailUrl!: string;

  @Prop({ trim: true, default: '' })
  thumbnailPublicId!: string;

  @Prop({ default: 0, index: true })
  order!: number;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ default: false })
  isDeleted!: boolean;
}

export const DictationTopicSchema = SchemaFactory.createForClass(DictationTopic);
DictationTopicSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
