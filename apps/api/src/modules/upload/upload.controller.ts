/// <reference types="multer" />
import {
BadRequestException,
Body,
Controller,
Post,
UploadedFile,
UseGuards,
UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ManagedMediaService } from './managed-media.service.js';

@UseGuards(RolesGuard)
@Roles('ADMIN')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly mediaUploadService: ManagedMediaService,
  ) {}

  private isAudio(file: Express.Multer.File): boolean {
    if (file.mimetype?.startsWith('audio/')) return true;
    const ext = file.originalname?.split('.').pop()?.toLowerCase();
    return Boolean(ext && ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'webm', 'flac'].includes(ext));
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024 } }),
  )
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please provide a file to upload');
    }

    const result=await this.mediaUploadService.uploadFile(file, this.isAudio(file)?'audio':'image');
    return {message:'Media uploaded to S3-compatible object storage',data:result};
  }

  @Post('delete')
  async deleteFile(@Body() body: { public_id?: string; url?: string; resource_type?: string }) {
    const identifier = body?.public_id || body?.url;
    if (!identifier) {
      return { message: 'No identifier provided', success: false };
    }

    const result=await this.mediaUploadService.deleteFile(identifier,body?.resource_type);
    return {message:'Media deletion processed',data:result,success:result.result==='ok'};
  }
}
