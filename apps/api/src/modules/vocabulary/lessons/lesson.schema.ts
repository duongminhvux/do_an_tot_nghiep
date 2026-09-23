import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Collection } from '../collections/collection.schema.js';

export type LessonDocument = HydratedDocument<Lesson>;

@Schema({ timestamps: true })
export class Lesson {
  @Prop({ type: Types.ObjectId, ref: Collection.name, required: true, index: true })
  collectionId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true, index: true })
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

export const LessonSchema = SchemaFactory.createForClass(Lesson);
LessonSchema.index({ collectionId: 1, slug: 1 }, { unique: true });
