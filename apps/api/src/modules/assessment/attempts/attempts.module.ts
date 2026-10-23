import { Module } from '@nestjs/common';
import { User, UserSchema } from '../../users/schema/user.schema.js';
import {
  AdminAttemptsController,
  AdminExamAttemptsController } from './admin-attempts.controller.js';
import { AttemptsService } from './attempts.service.js';
import {
  AttemptsController,
  ExamPartsController } from './attempts.controller.js';
import { PgModelsModule } from '../../../postgres/compat.js';
import { Attempt, AttemptSchema } from './schemas/attempt.schema.js';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema.js';
import {
  Question,
  QuestionSchema } from '../questions/schemas/question.schema.js';
import { Passage, PassageSchema } from '../questions/schemas/passage.schema.js';

@Module({
  imports: [
    PgModelsModule.forFeature([
      { name: Attempt.name, schema: AttemptSchema },
      { name: User.name, schema: UserSchema },
      { name: Exam.name, schema: ExamSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Passage.name, schema: PassageSchema },
    ]),
  ],
  controllers: [
    AttemptsController,
    ExamPartsController,
    AdminAttemptsController,
    AdminExamAttemptsController,
  ],
  providers: [AttemptsService] })
export class AttemptsModule {}
