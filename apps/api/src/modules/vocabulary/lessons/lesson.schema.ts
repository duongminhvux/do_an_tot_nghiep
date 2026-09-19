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

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  coverUrl?: string;

  @Prop({ default: 0 })
  order?: number;

  @Prop({ default: true })
  isActive?: boolean;

  @Prop({ default: false })
  isDeleted?: boolean;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
