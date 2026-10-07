import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../../users/schema/user.schema.js';

export type ActivityLogDocument = HydratedDocument<ActivityLog>;

export enum ActivityCategory {
  AUTH = 'AUTH',
  SESSION = 'SESSION',
  VOCABULARY = 'VOCABULARY',
  DICTATION = 'DICTATION',
  ASSESSMENT = 'ASSESSMENT',
  GENERAL = 'GENERAL',
}

export enum ActivityAction {
  // Auth & Session
  AUTH_LOGIN = 'AUTH_LOGIN',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_REGISTER = 'AUTH_REGISTER',
  SESSION_START = 'SESSION_START',
  SESSION_END = 'SESSION_END',
  HEARTBEAT = 'HEARTBEAT',
  PAGE_VIEW = 'PAGE_VIEW',

  // Vocabulary
  VOCABULARY_LEARN = 'VOCABULARY_LEARN',
  VOCABULARY_TEST = 'VOCABULARY_TEST',
  VOCABULARY_SAVE = 'VOCABULARY_SAVE',

  // Dictation
  DICTATION_START = 'DICTATION_START',
  DICTATION_SUBMIT = 'DICTATION_SUBMIT',

  // Assessment / TOEIC
  TOEIC_START = 'TOEIC_START',
  TOEIC_SUBMIT = 'TOEIC_SUBMIT',

  // Other / Generic
  CUSTOM = 'CUSTOM',
}

@Schema({ timestamps: true })
export class ActivityLog {
  @Prop({ type: Types.ObjectId, ref: User.name, required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ type: String, trim: true, index: true, default: null })
  userEmail?: string;

  @Prop({ type: String, trim: true, default: null })
  userName?: string;

  @Prop({ type: String, default: 'USER' })
  role?: string;

  @Prop({ type: String, required: true, index: true })
  action!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ActivityCategory),
    default: ActivityCategory.GENERAL,
    index: true,
  })
  category!: ActivityCategory;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata?: Record<string, any>;

  @Prop({ type: String, default: null })
  ipAddress?: string;

  @Prop({ type: String, default: null })
  userAgent?: string;

  @Prop({ type: String, default: 'SUCCESS', index: true })
  status!: string;

  @Prop({ type: Number, default: 0 })
  durationMs?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

// Compound indexes for fast admin querying and filtering
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ category: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ userEmail: 1, createdAt: -1 });
ActivityLogSchema.index({ status: 1, createdAt: -1 });
