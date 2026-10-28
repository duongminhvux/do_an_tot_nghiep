import { Module } from '@nestjs/common';


import { AdminExamsController } from './admin-exams.controller.js';
import { ExamsController } from './exams.controller.js';
import { ExamsService } from './exams.service.js';
import { ExamCommunityController } from './community/exam-community.controller.js';
import { ExamCommunityService } from './community/exam-community.service.js';


import { AdminExamGroupsController } from './admin-exam-groups.controller.js';
import { ExamGroupsController } from './exam-groups.controller.js';
import { ExamGroupsService } from './exam-groups.service.js';

@Module({
  imports: [],
  controllers: [
    ExamCommunityController,
    ExamsController,
    AdminExamsController,
    ExamGroupsController,
    AdminExamGroupsController,
  ],
  providers: [ExamsService, ExamGroupsService, ExamCommunityService],
  exports: [ExamsService, ExamGroupsService] })
export class ExamsModule {}
