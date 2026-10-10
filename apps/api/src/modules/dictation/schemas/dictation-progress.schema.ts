import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DictationLesson } from './dictation-lesson.schema.js';
import { User } from '../../users/schema/user.schema.js';

export type DictationProgressDocument = HydratedDocument<DictationProgress>;

@Schema({ _id: false })
export class DictationSegmentProgress {
  @Prop({ required: true, min: 0 })
  segmentIndex!: number;

  @Prop({ default: 0, min: 0 })
  attempts!: number;

  @Prop({ default: 0, min: 0 })
  wrongAttempts!: number;

  @Prop({ default: 0, min: 0 })
  replayCount!: number;

  @Prop({ default: false })
  correct!: boolean;

  @Prop({ default: false })
  firstTryCorrect!: boolean;

  @Prop({ default: false })
  revealed!: boolean;

  @Prop()
  completedAt?: Date;
}

const DictationSegmentProgressSchema = SchemaFactory.createForClass(DictationSegmentProgress);

@Schema({ timestamps: true })
export class DictationProgress {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: DictationLesson.name, required: true, index: true })
  lessonId!: Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  currentSegment!: number;

  @Prop({ type: [Number], default: [] })
  completedSegments!: number[];

  @Prop({ type: [Number], default: [] })
  revealedSegments!: number[];

  @Prop({ type: [DictationSegmentProgressSchema], default: [] })
  segmentProgress!: DictationSegmentProgress[];

  @Prop({ default: 0, min: 0 })
  correctCount!: number;

  @Prop({ default: 0, min: 0 })
  wrongCount!: number;

  @Prop({ default: 0, min: 0 })
  attempts!: number;

  @Prop({ default: false })
  transcriptRevealed!: boolean;

  @Prop()
  transcriptRevealedAt?: Date;

  @Prop({ default: false })
  completed!: boolean;

  @Prop({ default: Date.now })
  lastPracticedAt!: Date;
}

export const DictationProgressSchema = SchemaFactory.createForClass(DictationProgress);
DictationProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
