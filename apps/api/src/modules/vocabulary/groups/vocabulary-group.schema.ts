import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VocabularyGroupDocument = HydratedDocument<VocabularyGroup>;

@Schema({ timestamps: true })
export class VocabularyGroup {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, index: true })
  slug!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: 1 })
  order?: number;

  @Prop({ default: true })
  isActive?: boolean;

  @Prop({ default: false })
  isDeleted?: boolean;
}

export const VocabularyGroupSchema = SchemaFactory.createForClass(VocabularyGroup);

// Partial unique index: only active records must have unique name and slug
VocabularyGroupSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } },
);
VocabularyGroupSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } },
);
