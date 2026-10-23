import { PgId } from '../../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../../postgres/compat.js';
import { type PgDocument } from '../../../../postgres/compat.js';

export type VocabularyFolderDocument = PgDocument<VocabularyFolder>;

@PgEntity({ timestamps: true })
export class VocabularyFolder {
  @PgField({
    type: PgId,
    ref: 'User',
    required: true,
    index: true })
  userId: PgId;

  @PgField({ required: true, trim: true, minlength: 1, maxlength: 80 })
  name: string;

  @PgField({ trim: true, index: true })
  slug?: string;

  @PgField({ trim: true, maxlength: 300, default: '' })
  description: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const VocabularyFolderSchema =
  PgSchemaFactory.createForClass(VocabularyFolder);

VocabularyFolderSchema.index({ userId: 1, name: 1 }, { unique: true });
VocabularyFolderSchema.index(
  { userId: 1, slug: 1 },
  { unique: true, sparse: true },
);
