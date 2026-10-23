import { Module } from '@nestjs/common';
import { Attempt, AttemptSchema } from '../attempts/schemas/attempt.schema.js';
import { PgModelsModule } from '../../../postgres/compat.js';
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
    PgModelsModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: Attempt.name, schema: AttemptSchema },
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
  exports: [ExamsService, ExamGroupsService] })
export class ExamsModule {}
