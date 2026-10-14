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
import { randomUUID } from 'node:crypto';
import { CloudinaryService } from './cloudinary.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { MediaStorageService } from '../../common/media/media-storage.service.js';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly mediaStorage: MediaStorageService,
  ) {}

  private isAudio(file: Express.Multer.File): boolean {
    if (file.mimetype?.startsWith('audio/')) return true;
    const ext = file.originalname?.split('.').pop()?.toLowerCase();
    return Boolean(ext && ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'webm', 'flac'].includes(ext));
  }

  private audioExtension(file: Express.Multer.File): string {
    const ext = file.originalname?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
    return ext || 'audio';
  }

  @Public()
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async uploadFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please provide a file to upload');
    }

    // Audio is local-first during development. Images and other legacy assets
    // continue using Cloudinary so existing image flows are not disrupted.
    if (this.isAudio(file)) {
      const storageKey = `uploads/audio/${randomUUID()}.${this.audioExtension(file)}`;
      const stored = await this.mediaStorage.saveBuffer(storageKey, file.buffer);
      return {
        message: 'Audio uploaded to local media storage',
        data: {
          url: stored.url,
          public_id: `local:${stored.storageKey}`,
        },
      };
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

    const localKey = identifier.startsWith('local:')
      ? identifier.slice('local:'.length)
      : this.mediaStorage.storageKeyFromPublicUrl(identifier);
    if (localKey) {
      await this.mediaStorage.delete(localKey);
      return {
        message: 'File deleted from local media storage',
        data: { result: 'ok', storageKey: localKey },
      };
    }

    const result = await this.cloudinaryService.deleteFile(identifier, body?.resource_type);
    return {
      message: 'File deleted from Cloudinary',
      data: result,
    };
  }
}
