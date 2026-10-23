import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PgModelsModule } from './postgres/compat.js';
import { rootDotenvPath } from './platform/platform.module.js';
import { MediaStorageModule } from './common/media/media-storage.module.js';
import { AudioProcessingModule } from './modules/audio-processing/audio-processing.module.js';
import { InternalAudioWorkerController } from './internal-audio-worker.controller.js';
@Module({
  imports:[ConfigModule.forRoot({isGlobal:true,envFilePath:[rootDotenvPath()]}),
    PgModelsModule.forRootAsync(),MediaStorageModule,AudioProcessingModule],
  controllers:[InternalAudioWorkerController],
})
export class AudioWorkerModule {}
