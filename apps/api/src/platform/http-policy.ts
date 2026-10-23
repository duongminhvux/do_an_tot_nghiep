import type { ConfigService } from '@nestjs/config';

export type HttpConfig = Pick<ConfigService, 'get'>;

function configuredOrigin(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*')) {
    throw new Error(`Expected an exact HTTP(S) origin: ${value}`);
  }
  return url.origin;
}

export function httpPolicy(config: HttpConfig) {
  const origins = new Set([
    config.get<string>('FRONTEND_URL') || 'http://localhost:3000',
    config.get<string>('ADMIN_URL') || 'http://localhost:3001',
    ...(config.get<string>('CORS_ALLOWED_ORIGINS') || '').split(','),
  ].map(value => value.trim()).filter(Boolean).map(configuredOrigin));
  const hops = Number(config.get<string>('TRUST_PROXY_HOPS') ?? '1');
  if (!Number.isInteger(hops) || hops < 0 || hops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10');
  }
  // No Origin is normal for server-to-server clients. The string "null" is not.
  const allowsOrigin = (origin?: string) => origin === undefined || origins.has(origin);
  return { origins: [...origins], trustProxy: hops === 0 ? false : hops, allowsOrigin };
}
