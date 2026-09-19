import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionDocument = HydratedDocument<Collection>;

@Schema({ timestamps: true })
export class Collection {
  @Prop({ required: true, trim: true, unique: true })
  name!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  coverUrl?: string;

  @Prop({ trim: true, index: true })
  category?: string;

  @Prop({ default: 0 })
  order?: number;

  @Prop({ default: true })
  isActive?: boolean;

  @Prop({ default: false })
  isDeleted?: boolean;
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);
