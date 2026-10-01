import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuestionsService } from './questions.service.js';
import { QuestionsController } from './questions.controller.js';
import { Question, QuestionSchema } from './schemas/question.schema.js';
import { Passage, PassageSchema } from './schemas/passage.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Passage.name, schema: PassageSchema },
    ]),
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
