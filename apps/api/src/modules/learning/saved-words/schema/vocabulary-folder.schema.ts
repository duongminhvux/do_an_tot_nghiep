import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VocabularyFolderDocument = HydratedDocument<VocabularyFolder>;

@Schema({ timestamps: true })
export class VocabularyFolder {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 80 })
  name: string;

  @Prop({ trim: true, index: true })
  slug?: string;

  @Prop({ trim: true, maxlength: 300, default: '' })
  description: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const VocabularyFolderSchema =
  SchemaFactory.createForClass(VocabularyFolder);

VocabularyFolderSchema.index({ userId: 1, name: 1 }, { unique: true });
VocabularyFolderSchema.index(
  { userId: 1, slug: 1 },
  { unique: true, sparse: true },
);
