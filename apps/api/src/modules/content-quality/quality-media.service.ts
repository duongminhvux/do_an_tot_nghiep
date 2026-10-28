import { Injectable } from '@nestjs/common';
import { serviceUrl } from '../../postgres/ownership.js';
export type MediaOutcome = 'OK' | 'MISSING' | 'UNVERIFIED';

/** Only probe our configured media namespace. Never fetch a URL supplied by content. */
export function qualityMediaTarget(value: string): string | null {
  try {
    const base = new URL(
      process.env.MEDIA_PUBLIC_BASE_URL || 'http://localhost:5000/media',
    );
    const input = new URL(value, base.origin);
    if (input.username || input.password || input.search || input.hash)
      return null;
    const relative = value.startsWith('/') && !value.startsWith('//');
    const prefix = relative
      ? '/media/'
      : `${base.pathname.replace(/\/$/, '')}/`;
    if (
      (!relative && input.origin !== base.origin) ||
      !input.pathname.startsWith(prefix)
    )
      return null;
    const key = input.pathname.slice(prefix.length);
    if (
      !key ||
      /[\\%]/.test(key) ||
      key.split('/').some((p) => p === '..' || p === '.' || !p) ||
      /^(private|asr-jobs)\//.test(key)
    )
      return null;
    return `${serviceUrl('media-jobs').replace(/\/$/, '')}/media/${key}`;
  } catch {
    return null;
  }
}
@Injectable()
export class QualityMediaService {
  async probe(url: string): Promise<MediaOutcome> {
    const target = qualityMediaTarget(url);
    if (!target) return 'UNVERIFIED';
    try {
      const response = await fetch(target, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(3000),
      });
      await response.body?.cancel();
      return response.ok
        ? 'OK'
        : response.status === 404 || response.status === 410
          ? 'MISSING'
          : 'UNVERIFIED';
    } catch {
      return 'UNVERIFIED';
    }
  }
}
