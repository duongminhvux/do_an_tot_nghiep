import { ActivityCategory } from '../../../common/contracts/activity.types.js';
import type { SqlRow } from '../../../postgres/row.js';
export type ActivityLogRow = SqlRow<ActivityLog>;
export { ActivityAction,ActivityCategory } from '../../../common/contracts/activity.types.js';
export interface ActivityLog {
    userId?: string;
    userEmail?: string;
    userName?: string;
    role?: string;
    action: string;
    category: ActivityCategory;
    description: string;
    descriptionKey?: string;
    descriptionArgs?: Record<string, unknown>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    status: string;
    durationMs?: number;
    createdAt?: Date;
    updatedAt?: Date;
}
