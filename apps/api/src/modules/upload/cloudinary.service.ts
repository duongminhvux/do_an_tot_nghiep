/// <reference types="multer" />
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder = 'english-platform',
  ): Promise<{ url: string; public_id: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded or file buffer is empty');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            this.logger.error('Cloudinary upload failed', error);
            return reject(new BadRequestException(error.message || 'Upload to Cloudinary failed'));
          }
          if (!result) {
            return reject(new BadRequestException('Cloudinary did not return a result'));
          }
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  extractCloudinaryPublicId(url: string): { publicId: string; resourceType: string } | null {
    if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return null;

    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/');
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex === -1) return null;

      const resourceType = parts[uploadIndex - 1] || 'image';
      const afterUpload = parts.slice(uploadIndex + 1);
      const withoutVersion =
        afterUpload[0]?.startsWith('v') && /^\d+$/.test(afterUpload[0].slice(1))
          ? afterUpload.slice(1)
          : afterUpload;

      const fullPath = withoutVersion.join('/');
      const publicId = resourceType === 'raw' ? fullPath : fullPath.replace(/\.[^/.]+$/, '');
      return { publicId, resourceType };
    } catch {
      return null;
    }
  }

  async deleteFile(identifier: string, resourceType?: string): Promise<{ result: string }> {
    if (!identifier) return { result: 'noop' };

    let targetId = identifier;
    let targetType = resourceType;

    if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
      const extracted = this.extractCloudinaryPublicId(identifier);
      if (extracted) {
        targetId = extracted.publicId;
        targetType = targetType || extracted.resourceType;
      }
    }

    try {
      const res = await cloudinary.uploader.destroy(targetId, {
        resource_type: targetType || 'image',
      });
      if (res?.result === 'not found') {
        const rawRes = await cloudinary.uploader.destroy(targetId, {
          resource_type: 'raw',
        });
        return rawRes;
      }
      return res;
    } catch (err: any) {
      this.logger.warn(`Failed to delete Cloudinary asset ${targetId}:`, err?.message);
      return { result: 'error' };
    }
  }
}

