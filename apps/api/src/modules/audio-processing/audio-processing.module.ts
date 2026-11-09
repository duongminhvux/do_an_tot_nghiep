import { Module } from '@nestjs/common';

import { AdminAudioController } from './admin-audio.controller.js';
import { AdminInfrastructureController } from './admin-infrastructure.controller.js';
import { AudioProcessingCoreModule } from './audio-processing-core.module.js';

@Module({
  imports: [AudioProcessingCoreModule],
  controllers: [AdminAudioController, AdminInfrastructureController],
  exports: [AudioProcessingCoreModule] })
export class AudioProcessingModule {}
