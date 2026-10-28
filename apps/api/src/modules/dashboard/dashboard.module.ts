import { Module } from '@nestjs/common';

import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';





@Module({
  imports: [ActivityLogsModule],
  controllers: [DashboardController],
  providers: [DashboardService] })
export class DashboardModule {}
