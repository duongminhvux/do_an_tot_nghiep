import { Injectable } from '@nestjs/common';
import {
  InjectPgConnection,
  type PgConnection,
} from '../../postgres/compat.js';
import {
  normalizeSiteSettings,
  type SiteSettings,
} from '@repo/shared-types/site-settings';

export const SITE_SETTINGS_ID = '00000000-0000-4000-8000-000000000010';
@Injectable()
export class SiteSettingsService {
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
  ) {}
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
