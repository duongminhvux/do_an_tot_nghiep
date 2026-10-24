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
