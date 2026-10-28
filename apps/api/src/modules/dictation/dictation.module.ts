import { Module } from '@nestjs/common';

import { AdminDictationController } from './admin-dictation.controller.js';
import { DictationController } from './dictation.controller.js';
import { DictationService } from './dictation.service.js';





import { AsrModule } from '../asr/asr.module.js';
import { TtsModule } from '../tts/tts.module.js';
import { UploadModule } from '../upload/upload.module.js';

@Module({
  imports: [TtsModule,
UploadModule,
AsrModule],
  controllers: [DictationController, AdminDictationController],
  providers: [DictationService],
  exports: [DictationService] })
export class DictationModule {}
