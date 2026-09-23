import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Lesson } from './lesson.schema.js';

export type SectionDocument = HydratedDocument<Section>;

@Schema({ timestamps: true })
export class Section {
  @Prop({ type: Types.ObjectId, ref: Lesson.name, required: true, index: true })
  lessonId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, index: true })
  slug!: string;

  @Prop({ default: 1 })
  order?: number;
}

export const SectionSchema = SchemaFactory.createForClass(Section);
SectionSchema.index({ lessonId: 1, slug: 1 }, { unique: true });
SectionSchema.index({ lessonId: 1, order: 1 });

