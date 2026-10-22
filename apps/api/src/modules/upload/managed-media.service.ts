/// <reference types="multer" />
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MediaStorageService } from '../../common/media/media-storage.service.js';

/** S3/MinIO-only upload adapter. No Cloudinary SDK, secrets or network calls.
 * Old Cloudinary public IDs are not rewritten or destroyed on new deployment.
 */
@Injectable()
export class ManagedMediaService {
  private readonly logger=new Logger(ManagedMediaService.name);
  constructor(private readonly media:MediaStorageService) {}
  private safePath(value:string):string {
    return String(value||'uploads').split('/').map(part=>part.replace(/[^a-zA-Z0-9_-]/g,'-'))
      .filter(Boolean).join('/').slice(0,120)||'uploads';
  }
  private safeExtension(filename:string):string {
    const ext=filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12);
    return ext && ext!==filename.toLowerCase() ? `.${ext}` : '';
  }
  async uploadFile(file:Express.Multer.File,folder='uploads'):Promise<{url:string;public_id:string}> {
    if(!file?.buffer?.length) throw new BadRequestException('Empty upload');
    const key=`uploads/${this.safePath(folder)}/${randomUUID()}${this.safeExtension(file.originalname||'')}`;
    const saved=await this.media.saveBuffer(key,file.buffer);
    return {url:saved.url,public_id:`s3:${saved.storageKey}`};
  }
  async uploadBuffer(buffer:Buffer,options?:{folder?:string;resourceType?:string;format?:string;publicId?:string}) {
    if(!buffer?.length) throw new BadRequestException('Empty upload');
    const ext=(options?.format||'bin').replace(/[^a-zA-Z0-9]/g,'').slice(0,12)||'bin';
    const key=`uploads/${this.safePath(options?.folder||'uploads')}/${randomUUID()}.${ext}`;
    const saved=await this.media.saveBuffer(key,buffer);
    return {url:saved.url,public_id:`s3:${saved.storageKey}`};
  }
  isManagedUrl(url?:string|null):boolean {
    try{return Boolean(this.media.storageKeyFromPublicUrl(url));}catch{return false;}
  }
  async deleteFile(identifier:string,_resourceType?:string):Promise<{result:string}> {
    if(!identifier)return {result:'noop'};
    const key=identifier.startsWith('s3:')?identifier.slice(3):
      identifier.startsWith('local:')?identifier.slice(6):this.media.storageKeyFromPublicUrl(identifier);
    if(!key){
      // Data imported from an external CDN remains reachable until separately migrated;
      // never call the retired provider or delete unrelated URLs.
      this.logger.warn('Ignoring external/unknown asset ID; migrate media separately');
      return {result:'external-not-managed'};
    }
    await this.media.delete(key);
    return {result:'ok'};
  }
}
