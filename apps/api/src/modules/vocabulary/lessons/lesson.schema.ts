import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { Collection } from '../collections/collection.schema.js';

export type LessonDocument = PgDocument<Lesson>;

@PgEntity({ timestamps: true })
export class Lesson {
  @PgField({default:'DRAFT'}) publicationStatus: string;
  @PgField({default:1}) publicationRevision: number;
  @PgField({type:Object}) publicationValidation?: Record<string,unknown>;
  @PgField({ type: PgId, ref: Collection.name, required: true, index: true })
  collectionId!: PgId;

  @PgField({ required: true, trim: true })
  title!: string;

  @PgField({ required: true, trim: true, index: true })
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

export const LessonSchema = PgSchemaFactory.createForClass(Lesson);
LessonSchema.index({ collectionId: 1, slug: 1 }, { unique: true });
