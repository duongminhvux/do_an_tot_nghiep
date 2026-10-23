import { PgId } from '../../../postgres/compat.js';
import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { type PgDocument, PgSchemaDefinition } from '../../../postgres/compat.js';
import { User } from '../../users/schema/user.schema.js';

export type ActivityLogDocument = PgDocument<ActivityLog>;

import { ActivityCategory } from '../../../common/contracts/activity.types.js';
export { ActivityAction, ActivityCategory } from '../../../common/contracts/activity.types.js';

@PgEntity({ timestamps: true })
export class ActivityLog {
  @PgField({ type: PgId, ref: User.name, required: false, index: true })
  userId?: PgId;

  @PgField({ type: String, trim: true, index: true, default: null })
  userEmail?: string;

  @PgField({ type: String, trim: true, default: null })
  userName?: string;

  @PgField({ type: String, default: 'USER' })
  role?: string;

  @PgField({ type: String, required: true, index: true })
  action!: string;

  @PgField({
    type: String,
    required: true,
    enum: Object.values(ActivityCategory),
    default: ActivityCategory.GENERAL,
    index: true })
  category!: ActivityCategory;

  @PgField({ type: String, required: true })
  description!: string;

  @PgField({ type: PgSchemaDefinition.Types.Mixed, default: {} })
  metadata?: Record<string, any>;

  @PgField({ type: String, default: null })
  ipAddress?: string;

  @PgField({ type: String, default: null })
  userAgent?: string;

  @PgField({ type: String, default: 'SUCCESS', index: true })
  status!: string;

  @PgField({ type: Number, default: 0 })
  durationMs?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ActivityLogSchema = PgSchemaFactory.createForClass(ActivityLog);

// Compound indexes for fast admin querying and filtering
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ category: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ userEmail: 1, createdAt: -1 });
ActivityLogSchema.index({ status: 1, createdAt: -1 });
