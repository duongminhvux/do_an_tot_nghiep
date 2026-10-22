import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../../users/schema/user.schema.js';

export type ActivityLogDocument = HydratedDocument<ActivityLog>;

import { ActivityCategory } from '../../../common/contracts/activity.types.js';
export { ActivityAction, ActivityCategory } from '../../../common/contracts/activity.types.js';

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
