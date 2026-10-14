import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { CloudinaryService } from './cloudinary.service.js';
import { MediaStorageModule } from '../../common/media/media-storage.module.js';

@Module({
  imports: [MediaStorageModule],
  controllers: [UploadController],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class UploadModule {}
