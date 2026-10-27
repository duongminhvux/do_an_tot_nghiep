import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
} from '@repo/shared-types/site-settings';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UpdateSiteSettingsDto } from './site-settings.dto.js';
import {
  AdminSiteSettingsController,
  PublicSiteSettingsController,
} from './site-settings.controller.js';
import {
  SiteSettingsService,
  SITE_SETTINGS_ID,
} from './site-settings.service.js';

describe('website system settings', () => {
  it('provides safe defaults before the first save', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const service = new SiteSettingsService({ query } as never);
    expect(await service.read()).toEqual(DEFAULT_SITE_SETTINGS);
    expect(query.mock.calls[0]).toEqual([
      'SELECT payload FROM public.system_settings WHERE id = $1',
      [SITE_SETTINGS_ID],
    ]);
  });
  it('returns only public branding fields and keeps worker/private configuration isolated', async () => {
    const service = new SiteSettingsService({
      query: async () => ({
        rows: [
          {
            payload: {
              settings: {
                siteName: 'VocaLearn',
                timezone: 'UTC',
                secret: 'private',
              },
              maxWorkers: 2,
              internalToken: 'private',
            },
          },
        ],
      }),
    } as never);
    const settings = await service.read();
    expect(settings.siteName).toBe('VocaLearn');
    expect(settings.timezone).toBe('UTC');
    expect(Object.keys(settings)).toEqual(Object.keys(DEFAULT_SITE_SETTINGS));
    expect(JSON.stringify(settings)).not.toContain('private');
  });
  it('persists the website singleton using bound SQL parameters and round trips saved values', async () => {
    let payload: unknown;
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('INSERT')) payload = JSON.parse(params[1] as string);
      return { rows: [{ payload }] };
    });
    const service = new SiteSettingsService({ query } as never);
    const input = {
      ...DEFAULT_SITE_SETTINGS,
      siteName: "  Learner's Site  ",
      logoUrl: '/media/logo.png',
      iconUrl: '/media/icon.png',
      faviconUrl: '/media/favicon.ico',
      timezone: 'America/New_York',
    };
    const saved = await service.save(input);
    expect(saved.siteName).toBe("Learner's Site");
    expect(await service.read()).toEqual(saved);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
    expect(sql).not.toContain("Learner's Site");
    expect(params[0]).toBe(SITE_SETTINGS_ID);
    expect(JSON.parse(params[1] as string)).toEqual({
      key: 'website',
      settings: saved,
    });
  });
  it('allows clearing images and descriptions while retaining the website name', async () => {
    const dto = plainToInstance(UpdateSiteSettingsDto, {
      ...DEFAULT_SITE_SETTINGS,
      siteName: '  VocaLearn  ',
      siteDescription: '',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    expect(dto.siteName).toBe('VocaLearn');
  });
  it.each(['logoUrl', 'iconUrl', 'faviconUrl'])(
    'validates image URLs for %s',
    async (key) => {
      for (const value of [
        '',
        '/media/logo.png',
        'https://cdn.example.com/logo.svg',
      ]) {
        expect(
          await validate(
            plainToInstance(UpdateSiteSettingsDto, {
              ...DEFAULT_SITE_SETTINGS,
              [key]: value,
            }),
          ),
        ).toEqual([]);
      }
      for (const value of [
        'javascript:alert(1)',
        '//example.com/x.png',
        'data:image/svg+xml,x',
        '/bad\\path',
        'https://example.com/bad path',
        null,
      ]) {
        expect(
          (
            await validate(
              plainToInstance(UpdateSiteSettingsDto, {
                ...DEFAULT_SITE_SETTINGS,
                [key]: value,
              }),
            )
          ).some((error) => error.property === key),
        ).toBe(true);
      }
    },
  );
  it('rejects empty names, unsupported zones and oversized descriptions', async () => {
    for (const values of [
      { siteName: ' ' },
      { siteName: 'x'.repeat(101) },
      { timezone: 'Invalid/Zone' },
      { timezone: '' },
      { siteDescription: 'x'.repeat(301) },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(UpdateSiteSettingsDto, {
              ...DEFAULT_SITE_SETTINGS,
              ...values,
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    }
    expect(normalizeSiteSettings({ timezone: 'Invalid/Zone' }).timezone).toBe(
      DEFAULT_SITE_SETTINGS.timezone,
    );
  });
  it('lists server-supported zones with readable localized labels and preserves saved aliases', async () => {
    const service = new SiteSettingsService({
      query: async () => ({ rows: [{ payload: { settings: { timezone: 'US/Pacific' } } }] }),
    } as never);
    const en = await service.timezones('en');
    const vi = await service.timezones('vi');
    expect(new Set(en.map((zone) => zone.value)).size).toBe(en.length);
    expect(en.length).toBeGreaterThan(100);
    expect(en.find((zone) => zone.value === 'UTC')).toMatchObject({ offsetMinutes: 0 });
    const hcm = en.find((zone) => zone.value === 'Asia/Ho_Chi_Minh')!;
    expect(hcm.offsetMinutes).toBe(420);
    expect(hcm.label).toContain('UTC+07:00');
    expect(hcm.label).toContain('Ho Chi Minh');
    expect(vi.find((zone) => zone.value === hcm.value)!.label).not.toBe(hcm.label);
    expect(en.some((zone) => zone.value === 'US/Pacific')).toBe(true);
    for (const [index, zone] of en.entries()) {
      expect(() => new Intl.DateTimeFormat('en', { timeZone: zone.value })).not.toThrow();
      if (index) expect(zone.offsetMinutes).toBeGreaterThanOrEqual(en[index - 1].offsetMinutes);
    }
  });
  it('calculates current UTC offsets including fractional zones and daylight saving time', async () => {
    vi.useFakeTimers();
    try {
      const service = new SiteSettingsService({ query: async () => ({ rows: [] }) } as never);
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      const winter = await service.timezones('en');
      vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
      const summer = await service.timezones('en');
      expect(winter.find((zone) => zone.value === 'America/New_York')!.offsetMinutes).toBe(-300);
      expect(summer.find((zone) => zone.value === 'America/New_York')!.offsetMinutes).toBe(-240);
      expect(winter.find((zone) => zone.value === 'Asia/Katmandu' || zone.value === 'Asia/Kathmandu')!.label).toContain('UTC+05:45');
    } finally {
      vi.useRealTimers();
    }
  });
  it('allows anonymous reads while restricting writes to admin', () => {
    expect(
      Reflect.getMetadata(
        'isPublic',
        PublicSiteSettingsController.prototype.read,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(PATH_METADATA, AdminSiteSettingsController),
    ).toBe('admin/site-settings');
    expect(Reflect.getMetadata('roles', AdminSiteSettingsController)).toEqual([
      'ADMIN',
    ]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminSiteSettingsController),
    ).toContain(RolesGuard);
    expect(
      Reflect.getMetadata(
        'isPublic',
        AdminSiteSettingsController.prototype.save,
      ),
    ).not.toBe(true);
  });
});
