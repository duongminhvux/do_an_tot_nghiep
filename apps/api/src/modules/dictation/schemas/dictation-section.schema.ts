import { PgId } from '../../../postgres/compat.js';
import { PgField, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { DictationTopic } from './dictation-topic.schema.js';

export type DictationSectionDocument = PgDocument<DictationSection>;

export class DictationSection {
  @PgField({ type: PgId, ref: DictationTopic.name, required: true, index: true })
  topicId!: PgId;

  @PgField({ required: true, trim: true })
  title!: string;

  @PgField({ required: true, trim: true })
  slug!: string;

  @PgField({ trim: true, default: '' })
  description!: string;

  @PgField({ default: 0, index: true })
  order!: number;

  @PgField({ default: true, index: true })
  isActive!: boolean;

  @PgField({ default: false })
  isDeleted!: boolean;
}

export const DictationSectionSchema = PgSchemaFactory.createForClass(DictationSection);
