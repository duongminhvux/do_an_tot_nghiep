import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActivityLog,
  ActivityLogSchema,
} from './schemas/activity-log.schema.js';
import { User, UserSchema } from '../users/schema/user.schema.js';
import { ActivityLogsService } from './activity-logs.service.js';
import { ActivityLogsController } from './activity-logs.controller.js';
import { AdminActivityLogsController } from './admin-activity-logs.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ActivityLogsController, AdminActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
