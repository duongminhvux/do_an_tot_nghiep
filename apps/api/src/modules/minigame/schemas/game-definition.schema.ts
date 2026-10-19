import type {
  MeaningTypingSettings,
  TypingRushSettings,
} from '../game-registry.js';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
export enum GameCategory {
  SOLO = 'SOLO',
  MULTIPLAYER = 'MULTIPLAYER',
}
@Schema({ timestamps: true, versionKey: false })
export class GameDefinition {
  @Prop({ type: Object, default: null })
  settings: TypingRushSettings | MeaningTypingSettings | null;
  @Prop({ required: true, unique: true }) code: string;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ default: '', trim: true }) nameEn: string;
  @Prop({ default: '' }) description: string;
  @Prop({ default: '' }) descriptionEn: string;
  @Prop({ default: '' }) imageUrl: string;
  @Prop({
    type: String,
    enum: ['NEW', 'POPULAR', 'FEATURED', null],
    default: null,
  })
  badge: 'NEW' | 'POPULAR' | 'FEATURED' | null;
  @Prop({ required: true }) destination: string;
  @Prop({ enum: GameCategory, type: String, default: GameCategory.SOLO })
  category: GameCategory;
  @Prop({ default: 0 }) order: number;
  @Prop({ default: true }) isActive: boolean;
}
export const GameDefinitionSchema =
  SchemaFactory.createForClass(GameDefinition);
GameDefinitionSchema.index({ isActive: 1, order: 1, _id: 1 });
