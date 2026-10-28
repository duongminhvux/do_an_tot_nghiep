
import { Module } from '@nestjs/common';



import { ActivityLogsController } from './activity-logs.controller.js';
import { ActivityLogsService } from './activity-logs.service.js';
import { AdminActivityLogsController } from './admin-activity-logs.controller.js';

@Module({
  imports: [],
  controllers: [ActivityLogsController, AdminActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService] })
export class ActivityLogsModule {}
