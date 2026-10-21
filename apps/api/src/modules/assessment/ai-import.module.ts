import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Exam, ExamSchema } from './exams/schemas/exam.schema.js';
import { PdfAiController, PdfAiBundleController } from './questions/pdf-ai.controller.js';
import { PdfAiService } from './questions/pdf-ai.service.js';
import { PdfAiLearningService, PdfAiCorrectionEvent, PdfAiCorrectionEventSchema } from './questions/pdf-ai-learning.service.js';

// The AI API is deployed independently from TOEIC CRUD. The PDF workers and
// Ollama remain Python containers; this adapter exposes the existing routes.
@Module({
  imports: [MongooseModule.forFeature([
    { name: Exam.name, schema: ExamSchema },
    { name: PdfAiCorrectionEvent.name, schema: PdfAiCorrectionEventSchema },
  ])],
  controllers: [PdfAiController, PdfAiBundleController],
  providers: [PdfAiService, PdfAiLearningService],
})
export class AiImportModule {}
