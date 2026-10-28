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
export interface LearningActivity {
    userId: string;
    module: LearningModule;
    type: LearningActivityType;
    sourceKey: string;
    title?: string;
    refId?: string;
    link?: string;
    correct?: number;
    total?: number;
    score?: number;
    durationSec?: number;
    xp: number;
    occurredAt: Date;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}
