import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument } from '../../../postgres/compat.js';
import { DictationLesson } from './dictation-lesson.schema.js';
import { User } from '../../users/schema/user.schema.js';

export type DictationProgressDocument = PgDocument<DictationProgress>;

@PgEntity({ _id: false })
export class DictationSegmentProgress {
  @PgField({ required: true, min: 0 })
  segmentIndex!: number;

  @PgField({ default: 0, min: 0 })
  attempts!: number;

  @PgField({ default: 0, min: 0 })
  wrongAttempts!: number;

  @PgField({ default: 0, min: 0 })
  replayCount!: number;

  @PgField({ default: false })
  correct!: boolean;

  @PgField({ default: false })
  firstTryCorrect!: boolean;

  @PgField({ default: false })
  revealed!: boolean;

  @PgField()
  completedAt?: Date;
}

const DictationSegmentProgressSchema = PgSchemaFactory.createForClass(DictationSegmentProgress);

@PgEntity({ timestamps: true })
export class DictationProgress {
  @PgField({ type: PgId, ref: User.name, required: true, index: true })
  userId!: PgId;

  @PgField({ type: PgId, ref: DictationLesson.name, required: true, index: true })
  lessonId!: PgId;

  @PgField({ default: 0, min: 0 })
  currentSegment!: number;

  @PgField({ type: [Number], default: [] })
  completedSegments!: number[];

  @PgField({ type: [Number], default: [] })
  revealedSegments!: number[];

  @PgField({ type: [DictationSegmentProgressSchema], default: [] })
  segmentProgress!: DictationSegmentProgress[];

  @PgField({ default: 0, min: 0 })
  correctCount!: number;

  @PgField({ default: 0, min: 0 })
  wrongCount!: number;

  @PgField({ default: 0, min: 0 })
  attempts!: number;

  @PgField({ default: false })
  transcriptRevealed!: boolean;

  @PgField()
  transcriptRevealedAt?: Date;

  @PgField({ default: false })
  completed!: boolean;

  @PgField({ default: Date.now })
  lastPracticedAt!: Date;
}

export const DictationProgressSchema = PgSchemaFactory.createForClass(DictationProgress);
DictationProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
