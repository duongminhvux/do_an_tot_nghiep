import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import type { PgDocument } from '../../../postgres/compat.js';

export type VocabularyGroupDocument = PgDocument<VocabularyGroup>;

@PgEntity({ timestamps: true })
export class VocabularyGroup {
  @PgField({ required: true, trim: true })
  name!: string;

  @PgField({ required: true, trim: true })
  slug!: string;

  @PgField({ trim: true })
  description?: string;

  @PgField({ default: 1 })
  order?: number;

  @PgField({ default: true })
  isActive?: boolean;

  @PgField({ default: false })
  isDeleted?: boolean;
}

export const VocabularyGroupSchema = PgSchemaFactory.createForClass(VocabularyGroup);

// Partial unique index: only active records must have unique name and slug
VocabularyGroupSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
VocabularyGroupSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
