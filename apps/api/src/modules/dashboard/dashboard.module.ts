import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { User, UserSchema } from '../users/schema/user.schema.js';
import { Exam, ExamSchema } from '../assessment/exams/schemas/exam.schema.js';
import { Attempt, AttemptSchema } from '../assessment/attempts/schemas/attempt.schema.js';
import {
  ActivityLog,
  ActivityLogSchema,
} from '../activity-logs/schemas/activity-log.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: Attempt.name, schema: AttemptSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
