import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuestionsService } from './questions.service.js';
import { QuestionsController } from './questions.controller.js';
import { Question, QuestionSchema } from './schemas/question.schema.js';
import { PassageGroup, PassageGroupSchema } from './schemas/passage-group.schema.js';
import { Passage, PassageSchema } from './schemas/passage.schema.js';
import { UploadModule } from '../../upload/upload.module.js';
import { Exam, ExamSchema } from '../exams/schemas/exam.schema.js';

@Module({
  imports: [
    UploadModule,
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: PassageGroup.name, schema: PassageGroupSchema },
      { name: Passage.name, schema: PassageSchema },
      { name: Exam.name, schema: ExamSchema },
    ]),
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
