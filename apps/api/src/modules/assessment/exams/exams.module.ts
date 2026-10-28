import { Module } from '@nestjs/common';


import { AdminExamsController } from './admin-exams.controller.js';
import { ExamsController } from './exams.controller.js';
import { ExamsService } from './exams.service.js';


import { AdminExamGroupsController } from './admin-exam-groups.controller.js';
import { ExamGroupsController } from './exam-groups.controller.js';
import { ExamGroupsService } from './exam-groups.service.js';

@Module({
  imports: [],
  controllers: [
    ExamsController,
    AdminExamsController,
    ExamGroupsController,
    AdminExamGroupsController,
  ],
  providers: [ExamsService, ExamGroupsService],
  exports: [ExamsService, ExamGroupsService] })
export class ExamsModule {}
