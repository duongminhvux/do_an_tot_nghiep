import { LearningActivity, LearningActivitySchema } from '../learning-activity/schemas/learning-activity.schema.js';
import { Module } from '@nestjs/common';
import { PgModelsModule } from '../../postgres/compat.js';
import {
  ActivityLog,
  ActivityLogSchema } from './schemas/activity-log.schema.js';
import { User, UserSchema } from '../users/schema/user.schema.js';
import { ActivityLogsService } from './activity-logs.service.js';
import { ActivityLogsController } from './activity-logs.controller.js';
import { AdminActivityLogsController } from './admin-activity-logs.controller.js';

@Module({
  imports: [
    PgModelsModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
      { name: User.name, schema: UserSchema },
      { name: LearningActivity.name, schema: LearningActivitySchema },
    ]),
  ],
  controllers: [ActivityLogsController, AdminActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService] })
export class ActivityLogsModule {}
