import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
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
@Schema({
  collection: 'learning_activities',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class LearningActivity {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: LEARNING_MODULES, required: true })
  module: LearningModule;

  @Prop({ type: String, enum: LEARNING_ACTIVITY_TYPES, required: true })
  type: LearningActivityType;

  // Identifies the source record so recording the same completion twice
  // (retries, backfill re-runs) never creates a duplicate.
  @Prop({ required: true })
  sourceKey: string;

  @Prop() title?: string;
  @Prop() refId?: string;
  @Prop() link?: string;
  @Prop() correct?: number;
  @Prop() total?: number;
  @Prop() score?: number;
  @Prop() durationSec?: number;

  @Prop({ required: true, min: 0 })
  xp: number;

  @Prop({ type: Date, required: true })
  occurredAt: Date;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, unknown>;

  createdAt: Date;
}

export const LearningActivitySchema =
  SchemaFactory.createForClass(LearningActivity);
LearningActivitySchema.index({ userId: 1, sourceKey: 1 }, { unique: true });
LearningActivitySchema.index({ userId: 1, occurredAt: -1 });
LearningActivitySchema.index({ userId: 1, module: 1, occurredAt: -1 });
