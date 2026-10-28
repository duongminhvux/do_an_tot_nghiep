import { Module } from '@nestjs/common';
import { MediaStorageModule } from '../../common/media/media-storage.module.js';
import { ManagedMediaService } from './managed-media.service.js';
import { UploadController } from './upload.controller.js';

@Module({
  imports: [MediaStorageModule],
  controllers: [UploadController],
  providers: [ManagedMediaService],
  exports: [ManagedMediaService] })
export class UploadModule {}
