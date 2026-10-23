import type {
  WordShooterSettings,
  MeaningTypingSettings,
  TypingRushSettings } from '../game-registry.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
export enum GameCategory {
  SOLO = 'SOLO',
  MULTIPLAYER = 'MULTIPLAYER' }
@PgEntity({ timestamps: true, versionKey: false })
export class GameDefinition {
  @PgField({ type: Object, default: null })
  settings:
    TypingRushSettings | MeaningTypingSettings | WordShooterSettings | null;
  @PgField({ required: true, unique: true }) code: string;
  @PgField({ required: true, trim: true }) name: string;
  @PgField({ default: '', trim: true }) nameEn: string;
  @PgField({ default: '' }) description: string;
  @PgField({ default: '' }) descriptionEn: string;
  @PgField({ default: '' }) imageUrl: string;
  @PgField({
    type: String,
    enum: ['NEW', 'POPULAR', 'FEATURED', null],
    default: null })
  badge: 'NEW' | 'POPULAR' | 'FEATURED' | null;
  @PgField({ required: true }) destination: string;
  @PgField({ enum: GameCategory, type: String, default: GameCategory.SOLO })
  category: GameCategory;
  @PgField({ default: 0 }) order: number;
  @PgField({ default: true }) isActive: boolean;
}
export const GameDefinitionSchema =
  PgSchemaFactory.createForClass(GameDefinition);
GameDefinitionSchema.index({ isActive: 1, order: 1, _id: 1 });
