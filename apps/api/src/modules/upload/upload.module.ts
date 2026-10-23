import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { ManagedMediaService } from './managed-media.service.js';
import { MediaStorageModule } from '../../common/media/media-storage.module.js';

@Module({
  imports: [MediaStorageModule],
  controllers: [UploadController],
  providers: [ManagedMediaService],
  exports: [ManagedMediaService] })
export class UploadModule {}
