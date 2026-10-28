import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { VocabularyGroup } from '../groups/vocabulary-group.schema.js';

export type CollectionDocument = PgDocument<Collection>;

export class Collection {
  @PgField({ type: PgId, ref: VocabularyGroup.name, index: true })
  groupId?: PgId;

  @PgField({ required: true, trim: true })
  name!: string;

  @PgField({ required: true, trim: true })
  slug!: string;

  @PgField({ trim: true })
  description?: string;

  @PgField({ trim: true })
  coverUrl?: string;

  @PgField({ default: 1 })
  order?: number;

  @PgField({ default: true })
  isActive?: boolean;

  @PgField({ default: false })
  isDeleted?: boolean;
}

export const CollectionSchema = PgSchemaFactory.createForClass(Collection);
