import type { CookieOptions, Request, Response } from 'express';
import ms, { type StringValue } from 'ms';
import type { HttpConfig } from '../../platform/http-policy.js';

type Audience = 'user' | 'admin';
const names: Record<Audience, string> = { user: 'user_refresh_token', admin: 'admin_refresh_token' };

export function refreshCookieOptions(config: HttpConfig, audience: Audience): CookieOptions {
  const setting = config.get<string>('COOKIE_SECURE') || 'auto';
  if (!['auto', 'true', 'false'].includes(setting)) throw new Error('COOKIE_SECURE must be auto, true or false');
  const secure = setting === 'true' || (setting === 'auto' && ['FRONTEND_URL', 'ADMIN_URL']
    .some(key => (config.get<string>(key) || '').startsWith('https://')));
  const sameSite = config.get<string>('COOKIE_SAME_SITE') || 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite)) throw new Error('Invalid COOKIE_SAME_SITE');
  if (sameSite === 'none' && !secure) throw new Error('SameSite=None requires COOKIE_SECURE=true');
  // Host-only cookies support unrelated domains without sharing admin sessions.
  return { httpOnly: true, secure, sameSite: sameSite as 'lax' | 'strict' | 'none',
    path: audience === 'admin' ? '/api/admin/auth' : '/api/auth' };
}

export function setRefreshCookie(res: Response, token: string, config: HttpConfig, audience: Audience) {
  const maxAge = ms((config.get<string>('JWT_REFRESH_TOKEN_EXPIRES') || '7d') as StringValue);
  if (!Number.isFinite(maxAge) || maxAge <= 0) throw new Error('Invalid JWT_REFRESH_TOKEN_EXPIRES');
  res.cookie(names[audience], token, { ...refreshCookieOptions(config, audience), maxAge });
}

export function readRefreshCookie(req: Pick<Request, 'cookies'>, audience: Audience): string | undefined {
  // Allow existing sessions to migrate when they next refresh.
  return req.cookies?.[names[audience]] || req.cookies?.refresh_token;
}

export function clearRefreshCookie(res: Response, config: HttpConfig, audience: Audience) {
  const options = refreshCookieOptions(config, audience);
  res.clearCookie(names[audience], options);
  res.clearCookie('refresh_token', { ...options, path: '/' });
}
