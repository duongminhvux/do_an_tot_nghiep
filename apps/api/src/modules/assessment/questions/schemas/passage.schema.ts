import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PassageDocument = HydratedDocument<Passage>;

@Schema({ timestamps: true })
export class Passage {
  @Prop({
    type: Types.ObjectId,
    ref: 'PassageGroup',
    required: true,
    index: true,
  })
  passageGroupId: Types.ObjectId;

  @Prop({
    required: true,
    enum: [
      'TEXT',
      'EMAIL',
      'ADVERTISEMENT',
      'ARTICLE',
      'NOTICE',
      'CHAT',
    ],
  })
  type:
    | 'TEXT'
    | 'EMAIL'
    | 'ADVERTISEMENT'
    | 'ARTICLE'
    | 'NOTICE'
    | 'CHAT';


  @Prop({
    trim: true,
  })
  content?: string;

  @Prop({
    trim: true,
  })
  audioUrl?: string;

  @Prop({
    trim: true,
  })
  imageUrl?: string;

  @Prop({
    default: 0,
    min: 0,
  })
  order: number;
}

export const PassageSchema = SchemaFactory.createForClass(Passage);