import { Module } from '@nestjs/common';
import { PgModelsModule } from '../../postgres/compat.js';
import { TtsModule } from '../tts/tts.module.js';
import { Word, WordSchema } from '../vocabulary/words/word.schema.js';
import { Question, QuestionSchema } from '../assessment/questions/schemas/question.schema.js';
import { Passage, PassageSchema } from '../assessment/questions/schemas/passage.schema.js';
import { PassageGroup, PassageGroupSchema } from '../assessment/questions/schemas/passage-group.schema.js';
import { AudioProcessingService } from './audio-processing.service.js';
import { AudioQueueService } from './audio-queue.service.js';
import { AdminAudioController } from './admin-audio.controller.js';
import { AdminInfrastructureController } from './admin-infrastructure.controller.js';

@Module({
  imports: [
    TtsModule,
    PgModelsModule.forFeature([
      { name: Word.name, schema: WordSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Passage.name, schema: PassageSchema },
      { name: PassageGroup.name, schema: PassageGroupSchema },
    ]),
  ],
  controllers: [AdminAudioController, AdminInfrastructureController],
  providers: [AudioProcessingService, AudioQueueService],
  exports: [AudioProcessingService, AudioQueueService] })
export class AudioProcessingModule {}
