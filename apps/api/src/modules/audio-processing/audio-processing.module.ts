import { Module } from '@nestjs/common';

import { TtsModule } from '../tts/tts.module.js';




import { AdminAudioController } from './admin-audio.controller.js';
import { AdminInfrastructureController } from './admin-infrastructure.controller.js';
import { AudioProcessingService } from './audio-processing.service.js';
import { AudioQueueService } from './audio-queue.service.js';

@Module({
  imports: [TtsModule],
  controllers: [AdminAudioController, AdminInfrastructureController],
  providers: [AudioProcessingService, AudioQueueService],
  exports: [AudioProcessingService, AudioQueueService] })
export class AudioProcessingModule {}
