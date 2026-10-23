import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import {
  ARENA_DEFAULTS,
  type ArenaConfiguration } from './arena-settings.defaults.js';
@PgEntity({ timestamps: true, versionKey: false })
export class ArenaSettings {
  @PgField({ required: true, unique: true }) key: string;
  @PgField({ default: 0 }) revision: number;
  @PgField({ type: Object, default: () => structuredClone(ARENA_DEFAULTS) })
  config: ArenaConfiguration;
}
export const ArenaSettingsSchema = PgSchemaFactory.createForClass(ArenaSettings);
