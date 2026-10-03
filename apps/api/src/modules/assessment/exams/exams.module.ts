import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamsService } from './exams.service.js';
import { ExamsController } from './exams.controller.js';
import { AdminExamsController } from './admin-exams.controller.js';
import { Exam, ExamSchema } from './schemas/exam.schema.js';
import { ExamGroup, ExamGroupSchema } from './schemas/exam-group.schema.js';
import { ExamGroupsService } from './exam-groups.service.js';
import { ExamGroupsController } from './exam-groups.controller.js';
import { AdminExamGroupsController } from './admin-exam-groups.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: ExamGroup.name, schema: ExamGroupSchema },
    ]),
  ],
  controllers: [
    ExamsController,
    AdminExamsController,
    ExamGroupsController,
    AdminExamGroupsController,
  ],
  providers: [ExamsService, ExamGroupsService],
  exports: [ExamsService, ExamGroupsService],
})
export class ExamsModule {}

