import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExamGroupDocument = HydratedDocument<ExamGroup>;

@Schema({ timestamps: true })
export class ExamGroup {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: 0, min: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const ExamGroupSchema = SchemaFactory.createForClass(ExamGroup);

ExamGroupSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } },
);
ExamGroupSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } },
);
ExamGroupSchema.index({ order: 1 });
ExamGroupSchema.index({ isActive: 1, order: 1 });