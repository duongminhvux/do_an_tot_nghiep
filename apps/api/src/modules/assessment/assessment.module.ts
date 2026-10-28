import { Module } from '@nestjs/common';

import { AttemptsModule } from './attempts/attempts.module.js';
import { ExamsModule } from './exams/exams.module.js';
import { QuestionsModule } from './questions/questions.module.js';







@Module({
  imports: [ExamsModule,
QuestionsModule,
AttemptsModule],
  exports: [ExamsModule, QuestionsModule, AttemptsModule] })
export class AssessmentModule {}
