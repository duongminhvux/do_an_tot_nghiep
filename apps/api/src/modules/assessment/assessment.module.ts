import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamsModule } from './exams/exams.module.js';
import { QuestionsModule } from './questions/questions.module.js';
import { AttemptsModule } from './attempts/attempts.module.js';
import { Exam, ExamSchema } from './exams/schemas/exam.schema.js';
import { PassageGroup, PassageGroupSchema } from './questions/schemas/passage-group.schema.js';
import { Passage, PassageSchema } from './questions/schemas/passage.schema.js';
import { Question, QuestionSchema } from './questions/schemas/question.schema.js';
import { Attempt, AttemptSchema } from './attempts/schemas/attempt.schema.js';
import { AttemptAnswer, AttemptAnswerSchema } from './attempts/schemas/attempt-answer.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: PassageGroup.name, schema: PassageGroupSchema },
      { name: Passage.name, schema: PassageSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Attempt.name, schema: AttemptSchema },
      { name: AttemptAnswer.name, schema: AttemptAnswerSchema },
    ]),
    ExamsModule,
    QuestionsModule,
    AttemptsModule,
  ],
  exports: [ExamsModule, QuestionsModule, AttemptsModule],
})
export class AssessmentModule {}
