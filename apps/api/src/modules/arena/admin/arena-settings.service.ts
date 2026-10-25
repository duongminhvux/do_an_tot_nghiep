import { BadRequestException, ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPgModel } from '../../../postgres/compat.js';
import { WsException } from '@nestjs/websockets';
import type { Model } from '../../../postgres/compat.js';
import { ArenaSettings } from './arena-settings.schema.js';
import { ARENA_DEFAULTS } from './arena-settings.defaults.js';
import { UpdateArenaSettingsDto } from './arena-admin.dto.js';
@Injectable()
export class ArenaSettingsService implements OnModuleInit {
  constructor(
    @InjectPgModel(ArenaSettings.name)
    private readonly model: Model<ArenaSettings>,
  ) {}
  async onModuleInit() {
    await this.model.updateOne(
      { key: 'global' },
      {
        $setOnInsert: {
          key: 'global',
          revision: 0,
          config: structuredClone(ARENA_DEFAULTS) } },
      { upsert: true },
    );
  }
  async read() {
    const row = await this.model.findOne({ key: 'global' }).lean();
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
    const row = await this.model
      .findOneAndUpdate(
        { key: 'global', revision: dto.revision },
        { $set: { config }, $inc: { revision: 1 } },
        { returnDocument: 'after', runValidators: true },
      )
      .lean();
    if (!row) throw new ConflictException('ARENA_SETTINGS_CHANGED');
    return { revision: row.revision, config: row.config };
  }
}
