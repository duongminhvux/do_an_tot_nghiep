import { Module } from '@nestjs/common';
import { AsrService } from './asr.service.js';
import { AsrController } from './asr.controller.js';

@Module({
  controllers: [AsrController],
  providers: [AsrService],
  exports: [AsrService],
})
export class AsrModule {}
