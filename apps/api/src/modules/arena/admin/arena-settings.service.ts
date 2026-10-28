import { BadRequestException,ConflictException,Injectable,OnModuleInit } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { first,rows,sql } from '../../../postgres/sql.js';
import { UpdateArenaSettingsDto } from './arena-admin.dto.js';
import { ARENA_DEFAULTS } from './arena-settings.defaults.js';
@Injectable()
export class ArenaSettingsService implements OnModuleInit {
  constructor(
    @InjectPgConnection() private readonly db: PgConnection,
  ) {}
  async onModuleInit() {
    await rows(this.db, sql`INSERT INTO public.arenasettings (key,revision,config)
      VALUES ('global',0,${JSON.stringify(ARENA_DEFAULTS)}::jsonb) ON CONFLICT (key) DO NOTHING`);
  }

  async read() {
    const row = await first(this.db, sql`SELECT revision,config FROM public.arenasettings WHERE key='global'`);
    return {
      revision: row?.revision ?? 0,
      config: { ...structuredClone(ARENA_DEFAULTS), ...row?.config, hints: { ...ARENA_DEFAULTS.hints, ...row?.config?.hints }, rankedConnection: { ...ARENA_DEFAULTS.rankedConnection, ...row?.config?.rankedConnection }, audio: { ...ARENA_DEFAULTS.audio, ...row?.config?.audio } } };
  }
  async current() {
    return (await this.read()).config;
  }
  async requireEnabled(type: 'RANK' | 'FRIEND' | 'ROOM') {
    const config = await this.current();
    const section =
      type === 'RANK'
        ? config.ranked
        : type === 'ROOM'
          ? config.group
          : config.friendly;
    if (config.maintenance || !section.enabled)
      throw new WsException('ARENA_UNAVAILABLE');
    return config;
  }
  async update(dto: UpdateArenaSettingsDto) {
    const before = await this.read();
    const config = { ...dto.config, hints: { ...before.config.hints, ...dto.config.hints }, rankedConnection: { ...before.config.rankedConnection, ...dto.config.rankedConnection }, audio: { ...before.config.audio, ...dto.config.audio } };
    if (config.hints.maxPercent > 0 && config.hints.startAfterSeconds >= config.ranked.timePerQuestion)
      throw new BadRequestException('Hints must start before the ranked question deadline');
    if (config.rankedConnection.maxTotalPauseSeconds < config.rankedConnection.disconnectTimeoutSeconds)
      throw new BadRequestException('Pause budget must cover at least one disconnect timeout');
    const row = await first(this.db, sql`UPDATE public.arenasettings SET config=${JSON.stringify(config)}::jsonb,
      revision=revision+1,payload=payload-'config'-'revision' WHERE key='global' AND revision=${dto.revision} RETURNING revision,config`);
    if (!row) throw new ConflictException('ARENA_SETTINGS_CHANGED');
    return { revision: row.revision, config: row.config };
  }
}
