import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionDocument = HydratedDocument<Collection>;

@Schema({ timestamps: true })
export class Collection {
  @Prop({ required: true, trim: true, unique: true })
  name!: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
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

export const CollectionSchema = SchemaFactory.createForClass(Collection);
