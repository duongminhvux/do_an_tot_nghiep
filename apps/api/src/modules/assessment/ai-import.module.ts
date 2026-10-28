import { Module } from '@nestjs/common';


import { PdfAiLearningService } from './questions/pdf-ai-learning.service.js';
import { PdfAiBundleController,PdfAiController } from './questions/pdf-ai.controller.js';
import { PdfAiService } from './questions/pdf-ai.service.js';

// The AI API is deployed independently from TOEIC CRUD. The PDF workers and
// Ollama remain Python containers; this adapter exposes the existing routes.
@Module({
  imports: [],
  controllers: [PdfAiController, PdfAiBundleController],
  providers: [PdfAiService, PdfAiLearningService] })
export class AiImportModule {}
