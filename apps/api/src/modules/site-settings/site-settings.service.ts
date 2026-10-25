import { Injectable } from '@nestjs/common';
import {
  InjectPgConnection,
  type PgConnection,
} from '../../postgres/compat.js';
import {
  normalizeSiteSettings,
  type SiteSettings,
  type TimezoneOption,
} from '@repo/shared-types/site-settings';

export const SITE_SETTINGS_ID = '00000000-0000-4000-8000-000000000010';
@Injectable()
export class SiteSettingsService {
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
  ) {}
  async timezones(language?: string): Promise<TimezoneOption[]> {
    const locale = language?.toLowerCase().startsWith('en') ? 'en' : 'vi';
    const { timezone } = await this.read();
    const now = new Date();
    const values = new Set(['UTC', 'Asia/Ho_Chi_Minh', timezone, ...Intl.supportedValuesOf('timeZone')]);
    return [...values].map((value) => {
      const offset = new Intl.DateTimeFormat('en', { timeZone: value, timeZoneName: 'longOffset' })
        .formatToParts(now).find((part) => part.type === 'timeZoneName')!.value;
      const match = offset.match(/^GMT([+-])(\d{2}):(\d{2})$/);
      const offsetMinutes = match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '-' ? -1 : 1) : 0;
      const utc = offset === 'GMT' ? 'UTC+00:00' : offset.replace('GMT', 'UTC');
      const name = new Intl.DateTimeFormat(locale, { timeZone: value, timeZoneName: 'longGeneric' })
        .formatToParts(now).find((part) => part.type === 'timeZoneName')!.value;
      const place = value.replaceAll('_', ' ').split('/').join(' / ');
      return { value, label: `${utc} | ${place} | ${name}`, offsetMinutes };
    }).sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.label.localeCompare(b.label, locale));
  }

  async read(): Promise<SiteSettings> {
    const result = await this.connection.query(
      'SELECT payload FROM public.system_settings WHERE id = $1',
      [SITE_SETTINGS_ID],
    );
    return normalizeSiteSettings(result.rows[0]?.payload?.settings);
  }
  async save(input: SiteSettings): Promise<SiteSettings> {
    const settings = normalizeSiteSettings(input);
    const result = await this.connection.query(
      `INSERT INTO public.system_settings (id, payload) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
       RETURNING payload`,
      [SITE_SETTINGS_ID, JSON.stringify({ key: 'website', settings })],
    );
    return normalizeSiteSettings(result.rows[0]?.payload?.settings);
  }
}
