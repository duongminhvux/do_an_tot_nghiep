import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import type { PgDocument } from '../../../postgres/compat.js';

export type DictationTopicDocument = PgDocument<DictationTopic>;

export class DictationTopic {
  @PgField({ required: true, trim: true })
  title!: string;

  @PgField({ required: true, trim: true})
  slug!: string;

  @PgField({ trim: true, default: '' })
  description!: string;

  @PgField({ trim: true, default: '' })
  thumbnailUrl!: string;

  @PgField({ trim: true, default: '' })
  thumbnailPublicId!: string;

  @PgField({ default: 0, index: true })
  order!: number;

  @PgField({ default: true, index: true })
  isActive!: boolean;

  @PgField({ default: false })
  isDeleted!: boolean;
}

export const DictationTopicSchema = PgSchemaFactory.createForClass(DictationTopic);
