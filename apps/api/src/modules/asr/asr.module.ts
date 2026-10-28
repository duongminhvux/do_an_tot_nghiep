import { Module } from '@nestjs/common';
import { AsrController } from './asr.controller.js';
import { AsrService } from './asr.service.js';

@Module({
  controllers: [AsrController],
  providers: [AsrService],
  exports: [AsrService] })
export class AsrModule {}
