import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_DICTATION_SETTINGS,
  normalizeDictationSettings,
  shortcutConflicts,
  type DictationSettings,
} from '@repo/shared-types/dictation-settings';
import { InjectPgConnection, type PgConnection } from '../../postgres/connection.js';
import { first, sql } from '../../postgres/sql.js';

/** Global Dictation practice settings (single 'global' row, optimistic revision). */
@Injectable()
export class DictationSettingsService {
  constructor(
    @InjectPgConnection() private readonly db: PgConnection,
    private readonly configService: ConfigService,
  ) {}

  /** Defaults, with the legacy env knobs still honoured until an admin saves the page. */
  defaults(): DictationSettings {
    const base = normalizeDictationSettings(DEFAULT_DICTATION_SETTINGS);
    const envInt = (key: string) => {
      const value = Number(this.configService.get<string>(key));
      return Number.isFinite(value) && value >= 0 ? value : undefined;
    };
    return normalizeDictationSettings({
      ...base,
      practice: {
        ...base.practice,
        maxAttemptsBeforeReveal: envInt('DICTATION_MAX_ATTEMPTS_BEFORE_REVEAL') ?? base.practice.maxAttemptsBeforeReveal,
        autoNextDelayMs: envInt('DICTATION_AUTO_NEXT_DELAY_MS') ?? base.practice.autoNextDelayMs,
      },
    });
  }

  async read(): Promise<{ revision: number; updatedAt: string | null; config: DictationSettings }> {
    const row = await first(this.db, sql`SELECT revision, config, updated_at AS "updatedAt" FROM public.dictation_settings WHERE key='global'`);
    if (!row) return { revision: 0, updatedAt: null, config: this.defaults() };
    const defaults = this.defaults();
    const stored = row.config ?? {};
    const config = normalizeDictationSettings(
      Object.fromEntries(Object.keys(defaults).map((key) => [key, { ...(defaults as any)[key], ...(stored[key] ?? {}) }])),
    );
    return { revision: Number(row.revision), updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null, config };
  }

  async current(): Promise<DictationSettings> {
    return (await this.read()).config;
  }

  async update(revision: number, input: unknown, actorId?: string) {
    const config = normalizeDictationSettings(input);
    if (shortcutConflicts(config.shortcuts).length) throw new ConflictException('DICTATION_SHORTCUT_CONFLICT');
    const payload = JSON.stringify(config);
    const row = revision === 0
      ? await first(this.db, sql`INSERT INTO public.dictation_settings (key, revision, config, updated_by, updated_at)
          VALUES ('global', 1, ${payload}::jsonb, ${actorId ?? null}::uuid, now())
          ON CONFLICT (key) DO NOTHING RETURNING revision, config, updated_at AS "updatedAt"`)
      : await first(this.db, sql`UPDATE public.dictation_settings
          SET config=${payload}::jsonb, revision=revision+1, updated_by=${actorId ?? null}::uuid, updated_at=now()
          WHERE key='global' AND revision=${revision} RETURNING revision, config, updated_at AS "updatedAt"`);
    if (!row) throw new ConflictException('DICTATION_SETTINGS_CHANGED');
    return { revision: Number(row.revision), updatedAt: new Date(row.updatedAt).toISOString(), config: normalizeDictationSettings(row.config) };
  }
}
