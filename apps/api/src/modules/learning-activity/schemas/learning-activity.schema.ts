import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { PgSchemaDefinition } from '../../../postgres/compat.js';
import { LEARNING_MODULES } from '@repo/shared-types/learning-xp';
import type { LearningModule } from '@repo/shared-types/learning-xp';

export const LEARNING_ACTIVITY_TYPES = [
  'WORD_LEARNED',
  'WORD_REVIEWED',
  'VOCAB_SESSION',
  'DICTATION_LESSON',
  'TOEIC_ATTEMPT',
  'ARENA_MATCH',
  'MINIGAME_PLAY',
] as const;
export type LearningActivityType = (typeof LEARNING_ACTIVITY_TYPES)[number];

/**
 * One completed learning activity in any module. This is the single source for
 * the learner home page (XP, streak, heatmap, recent activity).
 */
@PgEntity({
  collection: 'learning_activities',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false })
export class LearningActivity {
  @PgField({ type: PgId, ref: 'User', required: true })
  userId: PgId;

  @PgField({ type: String, enum: LEARNING_MODULES, required: true })
  module: LearningModule;

  @PgField({ type: String, enum: LEARNING_ACTIVITY_TYPES, required: true })
  type: LearningActivityType;

  // Identifies the source record so recording the same completion twice
  // (retries, backfill re-runs) never creates a duplicate.
  @PgField({ required: true })
  sourceKey: string;

  @PgField() title?: string;
  @PgField() refId?: string;
  @PgField() link?: string;
  @PgField() correct?: number;
  @PgField() total?: number;
  @PgField() score?: number;
  @PgField() durationSec?: number;

  @PgField({ required: true, min: 0 })
  xp: number;

  @PgField({ type: Date, required: true })
  occurredAt: Date;

  @PgField({ type: PgSchemaDefinition.Types.Mixed })
  metadata?: Record<string, unknown>;

  createdAt: Date;
}

export const LearningActivitySchema =
  PgSchemaFactory.createForClass(LearningActivity);
LearningActivitySchema.index({ userId: 1, sourceKey: 1 }, { unique: true });
LearningActivitySchema.index({ userId: 1, occurredAt: -1 });
LearningActivitySchema.index({ userId: 1, module: 1, occurredAt: -1 });
