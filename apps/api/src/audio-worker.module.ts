import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaStorageModule } from './common/media/media-storage.module.js';
import { AudioProcessingModule } from './modules/audio-processing/audio-processing.module.js';
import { InternalAudioWorkerController } from './internal-audio-worker.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    MongooseModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({
      uri: config.getOrThrow<string>('MONGO_URI'),
      dbName: 'media_db',
      autoIndex: false,
    }) }),
    MediaStorageModule,
    AudioProcessingModule,
  ],
  controllers: [InternalAudioWorkerController],
})
export class AudioWorkerModule {}
