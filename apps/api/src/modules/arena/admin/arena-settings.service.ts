import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WsException } from '@nestjs/websockets';
import { Model } from 'mongoose';
import { ArenaSettings } from './arena-settings.schema.js';
import { ARENA_DEFAULTS } from './arena-settings.defaults.js';
import { UpdateArenaSettingsDto } from './arena-admin.dto.js';
@Injectable()
export class ArenaSettingsService implements OnModuleInit {
  constructor(
    @InjectModel(ArenaSettings.name)
    private readonly model: Model<ArenaSettings>,
  ) {}
  async onModuleInit() {
    await this.model.updateOne(
      { key: 'global' },
      {
        $setOnInsert: {
          key: 'global',
          revision: 0,
          config: structuredClone(ARENA_DEFAULTS),
        },
      },
      { upsert: true },
    );
  }
  async read() {
    const row = await this.model.findOne({ key: 'global' }).lean();
    return {
      revision: row?.revision ?? 0,
      config: row?.config ?? structuredClone(ARENA_DEFAULTS),
    };
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
    const row = await this.model
      .findOneAndUpdate(
        { key: 'global', revision: dto.revision },
        { $set: { config: dto.config }, $inc: { revision: 1 } },
        { returnDocument: 'after', runValidators: true },
      )
      .lean();
    if (!row) throw new ConflictException('ARENA_SETTINGS_CHANGED');
    return { revision: row.revision, config: row.config };
  }
}
