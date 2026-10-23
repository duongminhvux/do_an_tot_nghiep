import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { MiniGameType } from '../minigame.types.js';
@PgEntity({
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false })
export class MiniGameResult {
  @PgField({ type: PgId, ref: 'User', required: true })
  userId: PgId;
  @PgField({ type: String, enum: MiniGameType, required: true })
  gameType: MiniGameType;
  @PgField({ required: true, min: 0, max: 10_000_000 }) score: number;
  createdAt: Date;
}
export const MiniGameResultSchema =
  PgSchemaFactory.createForClass(MiniGameResult);
MiniGameResultSchema.index({ userId: 1, gameType: 1, score: -1 });
MiniGameResultSchema.index({ userId: 1, gameType: 1, createdAt: -1 });
