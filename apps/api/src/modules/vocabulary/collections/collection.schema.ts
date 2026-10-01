import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VocabularyGroup } from '../groups/vocabulary-group.schema.js';

export type CollectionDocument = HydratedDocument<Collection>;

@Schema({ timestamps: true })
export class Collection {
  @Prop({ type: Types.ObjectId, ref: VocabularyGroup.name, index: true })
  groupId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  slug!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  coverUrl?: string;

  @Prop({ default: 1 })
  order?: number;

  @Prop({ default: true })
  isActive?: boolean;

  @Prop({ default: false })
  isDeleted?: boolean;
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);

// Partial unique index: only active records must have unique name and slug
CollectionSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } },
);
CollectionSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } },
);
