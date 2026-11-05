import { Module } from '@nestjs/common';

import { TtsModule } from '../tts/tts.module.js';

import { AudioProcessingService } from './audio-processing.service.js';
import { AudioQueueService } from './audio-queue.service.js';

/**
 * Audio providers without HTTP controllers.
 * The standalone audio worker imports only this module, so it does not mount
 * admin routes that depend on the identity/JWT stack (ServiceJwtModule).
 */
@Module({
  imports: [TtsModule],
  providers: [AudioProcessingService, AudioQueueService],
  exports: [AudioProcessingService, AudioQueueService] })
export class AudioProcessingCoreModule {}
