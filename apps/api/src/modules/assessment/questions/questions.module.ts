import { Module } from '@nestjs/common';

import { PdfAiLearningService } from './pdf-ai-learning.service.js';
import { PdfAiService } from './pdf-ai.service.js';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';



import { UploadModule } from '../../upload/upload.module.js';


@Module({
  imports: [UploadModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, PdfAiService, PdfAiLearningService],
  exports: [QuestionsService] })
export class QuestionsModule {}
