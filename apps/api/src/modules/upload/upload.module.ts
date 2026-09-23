import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { CloudinaryService } from './cloudinary.service.js';

@Module({
  controllers: [UploadController],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class UploadModule {}
