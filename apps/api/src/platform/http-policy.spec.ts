import { ConfigService } from '@nestjs/config';
import { httpPolicy } from './http-policy.js';
import { clearRefreshCookie, readRefreshCookie, refreshCookieOptions, setRefreshCookie } from '../modules/auth/refresh-cookie.js';

describe('domain HTTP policy', () => {
  const config = (values: Record<string, string> = {}) => new ConfigService(values);

  it('allows canonical domains and exact aliases while rejecting other origins', () => {
    const policy = httpPolicy(config({ FRONTEND_URL: 'https://one.example', ADMIN_URL: 'https://admin.one.example',
      CORS_ALLOWED_ORIGINS: 'https://two.example, https://TWO.example/,https://two.example:8443' }));
    expect(policy.origins).toHaveLength(4);
    expect(policy.allowsOrigin('https://two.example')).toBe(true);
    expect(policy.allowsOrigin('https://two.example:8443')).toBe(true);
    expect(policy.allowsOrigin('https://two.example.evil.test')).toBe(false);
    expect(policy.allowsOrigin('http://two.example')).toBe(false);
    expect(policy.allowsOrigin('null')).toBe(false);
    expect(policy.allowsOrigin(undefined)).toBe(true);
  });

  it.each(['*', 'https://*.example', 'https://user:pass@example.com', 'https://example.com/path',
    'https://example.com?x=1', 'https://example.com#x', 'file:///tmp'])('rejects invalid origin %s', origin => {
    expect(() => httpPolicy(config({ CORS_ALLOWED_ORIGINS: origin }))).toThrow();
  });

  it('validates the explicit proxy hop count', () => {
    expect(httpPolicy(config({ TRUST_PROXY_HOPS: '0' })).trustProxy).toBe(false);
    expect(httpPolicy(config({ TRUST_PROXY_HOPS: '1' })).trustProxy).toBe(1);
    for (const value of ['true', '-1', '1.5', '100']) {
      expect(() => httpPolicy(config({ TRUST_PROXY_HOPS: value }))).toThrow();
    }
  });

  it('uses HTTP local cookies even in a production Docker image', () => {
    expect(refreshCookieOptions(config({ NODE_ENV: 'production' }), 'user')).toEqual({
      httpOnly: true, secure: false, sameSite: 'lax', path: '/api/auth',
    });
  });

  it('automatically secures HTTPS cookies and isolates admin sessions', () => {
    const settings = config({ FRONTEND_URL: 'https://one.example', ADMIN_URL: 'https://admin.one.example' });
    expect(refreshCookieOptions(settings, 'user').secure).toBe(true);
    const admin = refreshCookieOptions(settings, 'admin');
    expect(admin.path).toBe('/api/admin/auth');
    expect(admin).not.toHaveProperty('domain');
  });

  it('requires secure cookies for SameSite=None', () => {
    expect(() => refreshCookieOptions(config({ COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'false' }), 'user')).toThrow();
    expect(refreshCookieOptions(config({ COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'true' }), 'user').sameSite).toBe('none');
    expect(() => refreshCookieOptions(config({ COOKIE_SECURE: 'typo' }), 'user')).toThrow();
  });

  it('sets and clears cookies with matching scopes and reads legacy sessions', () => {
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };
    const settings = config({ COOKIE_SECURE: 'true', JWT_REFRESH_TOKEN_EXPIRES: '7d' });
    setRefreshCookie(response as any, 'admin-token', settings, 'admin');
    setRefreshCookie(response as any, 'user-token', settings, 'user');
    expect(response.cookie.mock.calls[0][0]).toBe('admin_refresh_token');
    expect(response.cookie.mock.calls[1][0]).toBe('user_refresh_token');
    expect(response.cookie.mock.calls[0][2].maxAge).toBe(604800000);
    clearRefreshCookie(response as any, settings, 'admin');
    const { maxAge, ...options } = response.cookie.mock.calls[0][2];
    expect(response.clearCookie).toHaveBeenCalledWith('admin_refresh_token', options);
    expect(readRefreshCookie({ cookies: { user_refresh_token: 'new', refresh_token: 'legacy' } }, 'user')).toBe('new');
    expect(readRefreshCookie({ cookies: { refresh_token: 'legacy' } }, 'admin')).toBe('legacy');
  });
});
