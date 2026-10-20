import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ARENA_DEFAULTS,
  type ArenaConfiguration,
} from './arena-settings.defaults.js';
@Schema({ timestamps: true, versionKey: false })
export class ArenaSettings {
  @Prop({ required: true, unique: true }) key: string;
  @Prop({ default: 0 }) revision: number;
  @Prop({ type: Object, default: () => structuredClone(ARENA_DEFAULTS) })
  config: ArenaConfiguration;
}
export const ArenaSettingsSchema = SchemaFactory.createForClass(ArenaSettings);
