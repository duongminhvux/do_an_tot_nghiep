/// <reference types="multer" />
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from './cloudinary.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Public()
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max
      },
    }),
  )
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please provide a file to upload');
    }

    const result = await this.cloudinaryService.uploadFile(file);
    return {
      message: 'File uploaded successfully',
      data: result,
    };
  }

  @Public()
  @Post('delete')
  async deleteFile(@Body() body: { public_id?: string; url?: string; resource_type?: string }) {
    const identifier = body?.public_id || body?.url;
    if (!identifier) {
      return { message: 'No identifier provided', success: false };
    }
    const result = await this.cloudinaryService.deleteFile(identifier, body?.resource_type);
    return {
      message: 'File deleted from Cloudinary',
      data: result,
    };
  }
}

