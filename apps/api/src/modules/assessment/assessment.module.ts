import { Module } from '@nestjs/common';
import { ExamsModule } from './exams/exams.module.js';
import { QuestionsModule } from './questions/questions.module.js';
import { AttemptsModule } from './attempts/attempts.module.js';

@Module({
  imports: [ExamsModule, QuestionsModule, AttemptsModule]
})
export class AssessmentModule {}
