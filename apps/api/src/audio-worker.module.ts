import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaStorageModule } from './common/media/media-storage.module.js';
import { InternalAudioWorkerController } from './internal-audio-worker.controller.js';
import { AudioProcessingModule } from './modules/audio-processing/audio-processing.module.js';
import { rootDotenvPath } from './platform/platform.module.js';
import { PgDatabaseModule } from './postgres/connection.js';
@Module({
  imports:[ConfigModule.forRoot({isGlobal:true,envFilePath:[rootDotenvPath()]}),
    PgDatabaseModule.forRootAsync(),MediaStorageModule,AudioProcessingModule],
  controllers:[InternalAudioWorkerController],
})
export class AudioWorkerModule {}
