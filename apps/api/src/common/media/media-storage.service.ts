import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

@Injectable()
export class MediaStorageService {
  readonly rootPath: string;
  private readonly publicBaseUrl: string;
  private readonly backend: 'local' | 's3';
  private readonly bridgeUrl: string;
  private readonly internalToken: string;

  constructor(private readonly configService: ConfigService) {
    const configuredPath = this.configService.get<string>('MEDIA_STORAGE_PATH') || './storage';
    if (path.isAbsolute(configuredPath)) {
      this.rootPath = configuredPath;
    } else {
      const cwd = process.cwd();
      const looksLikeApiWorkspace = /[\\/]apps[\\/]api$/.test(cwd.replace(/[\\/]$/, ''));
      const repositoryRoot = looksLikeApiWorkspace ? path.resolve(cwd, '../..') : cwd;
      this.rootPath = path.resolve(repositoryRoot, configuredPath);
    }

    this.backend = this.configService.get<string>('MEDIA_STORAGE_BACKEND') === 's3' ? 's3' : 'local';
    this.bridgeUrl = (this.configService.get<string>('MEDIA_BRIDGE_URL') || 'http://media-bridge:8010').replace(/\/$/, '');
    this.internalToken = this.configService.get<string>('MEDIA_INTERNAL_TOKEN') || '';
    this.publicBaseUrl = (
      this.configService.get<string>('MEDIA_PUBLIC_BASE_URL') || 'http://localhost:5000/media'
    ).replace(/\/$/, '');
  }

  normalizeStorageKey(storageKey: string): string {
    const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.split('/').some((part) => part === '..')) {
      throw new Error('Invalid media storage key');
    }
    return normalized;
  }

  absolutePath(storageKey: string): string {
    const normalized = this.normalizeStorageKey(storageKey);
    const target = path.resolve(this.rootPath, normalized);
    const root = path.resolve(this.rootPath);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error('Media path escapes storage root');
    }
    return target;
  }

  getPublicUrl(storageKey: string): string {
    return `${this.publicBaseUrl}/${this.normalizeStorageKey(storageKey)}`;
  }

  storageKeyFromPublicUrl(value?: string | null): string | null {
    if (!value) return null;
    const normalizedValue = value.trim();
    const prefix = `${this.publicBaseUrl}/`;
    if (normalizedValue.startsWith(prefix)) {
      return this.normalizeStorageKey(normalizedValue.slice(prefix.length));
    }

    try {
      const base = new URL(this.publicBaseUrl);
      const candidate = new URL(normalizedValue, this.publicBaseUrl);
      const basePath = base.pathname.replace(/\/$/, '');
      if (candidate.pathname.startsWith(`${basePath}/`)) {
        return this.normalizeStorageKey(candidate.pathname.slice(basePath.length + 1));
      }
    } catch {
      // Not a URL; support relative /media/... values below.
    }

    const mediaMarker = '/media/';
    const markerIndex = normalizedValue.indexOf(mediaMarker);
    if (markerIndex >= 0) {
      return this.normalizeStorageKey(normalizedValue.slice(markerIndex + mediaMarker.length));
    }
    return null;
  }

  private objectUrl(key: string): string {
    return `${this.bridgeUrl}/objects/${this.normalizeStorageKey(key).split('/').map(encodeURIComponent).join('/')}`;
  }

  private async bridgeRequest(method: string, key: string, body?: Buffer): Promise<Response> {
    if (!this.internalToken) throw new Error('MEDIA_INTERNAL_TOKEN is required for S3 storage');
    const response = await fetch(this.objectUrl(key), {
      method,
      headers: { 'x-internal-token': this.internalToken, ...(body ? { 'content-type': 'application/octet-stream' } : {}) },
      ...(body ? { body: new Uint8Array(body) } : {}),
      signal: AbortSignal.timeout(120_000),
    });
    return response;
  }

  async streamFromObject(key: string, range?: string): Promise<Response> {
    if (!this.internalToken) throw new Error('MEDIA_INTERNAL_TOKEN is required for S3 storage');
    return fetch(this.objectUrl(key), {
      headers: { 'x-internal-token': this.internalToken, ...(range ? { range } : {}) },
      signal: AbortSignal.timeout(60_000),
    });
  }

  useObjectStorage(): boolean { return this.backend === 's3'; }

  async saveBuffer(storageKey: string, buffer: Buffer): Promise<{ storageKey: string; url: string }> {
    const normalized = this.normalizeStorageKey(storageKey);
    if (this.backend === 's3') {
      const response = await this.bridgeRequest('PUT', normalized, buffer);
      if (!response.ok) throw new Error(`S3 object write failed (${response.status})`);
      return { storageKey: normalized, url: this.getPublicUrl(normalized) };
    }
    const target = this.absolutePath(normalized);
    await fs.mkdir(path.dirname(target), { recursive: true });

    const temp = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temp, buffer);
    await fs.rename(temp, target);

    return { storageKey: normalized, url: this.getPublicUrl(normalized) };
  }

  async delete(storageKey?: string | null): Promise<void> {
    if (!storageKey) return;
    if (this.backend === 's3') {
      const response = await this.bridgeRequest('DELETE', storageKey);
      if (!response.ok) throw new Error(`S3 delete failed (${response.status})`);
      return;
    }
    try {
      await fs.unlink(this.absolutePath(storageKey));
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  async exists(storageKey?: string | null): Promise<boolean> {
    if (!storageKey) return false;
    if (this.backend === 's3') {
      const response = await this.bridgeRequest('HEAD', storageKey);
      return response.ok;
    }
    try {
      await fs.access(this.absolutePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }
}
