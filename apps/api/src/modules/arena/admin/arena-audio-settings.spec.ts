import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { ARENA_DEFAULTS } from './arena-settings.defaults.js';
import { UpdateArenaSettingsDto } from './arena-admin.dto.js';
import { ArenaSettingsService } from './arena-settings.service.js';
import { ArenaReadService } from '../arena-read.service.js';

const userId = '00000000-0000-4000-8000-000000000001';
const matchId = '00000000-0000-4000-8000-000000000002';

describe('Arena audio settings', () => {
  it('normalizes saved configurations without audio and preserves existing values for older clients', async () => {
    const config = structuredClone(ARENA_DEFAULTS);
    config.audio.backgroundMusicUrl = '/audio/background.mp3';
    config.audio.audioEnabled = false;
    const row = { revision: 2, config };
    const model = {
      findOne: vi.fn(() => ({ lean: async () => row })),
      findOneAndUpdate: vi.fn((_filter, update) => ({
        lean: async () => ({ revision: 3, config: update.$set.config }),
      })),
    };
    const service = new ArenaSettingsService(model as never);
    const { audio: _audio, ...oldConfig } = config;
    const saved = await service.update({
      revision: 2,
      config: oldConfig,
      reason: 'Update limits',
    });
    expect(saved.config.audio.backgroundMusicUrl).toBe('/audio/background.mp3');
    expect(saved.config.audio.audioEnabled).toBe(false);
    const legacy = new ArenaSettingsService({
      findOne: () => ({
        lean: async () => ({ revision: 0, config: oldConfig }),
      }),
    } as never);
    expect((await legacy.read()).config.audio).toEqual(ARENA_DEFAULTS.audio);
    expect(model.findOneAndUpdate.mock.calls[0]![0]).toEqual({
      key: 'global',
      revision: 2,
    });
  });

  it('accepts nested audio and rejects invalid URLs at the admin boundary', async () => {
    const dto = plainToInstance(UpdateArenaSettingsDto, {
      revision: 0,
      reason: 'Configure audio',
      config: {
        ...ARENA_DEFAULTS,
        audio: {
          audioEnabled: false,
          backgroundMusicUrl: ' https://media.example.com/music.mp3 ',
          loseSoundUrl: '/audio/lose.wav',
        },
      },
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    expect(dto.config.audio?.backgroundMusicUrl).toBe(
      'https://media.example.com/music.mp3',
    );
    dto.config.audio!.loseSoundUrl = 'javascript:alert(1)';
    expect((await validate(dto))[0]?.property).toBe('config');
  });

  it('returns only the match snapshot and rejects nonparticipants', async () => {
    const member = vi.fn().mockResolvedValue({ userId });
    const snapshot = { backgroundMusicUrl: '/audio/original.mp3' };
    const matches = {
      findById: vi.fn(() => ({
        lean: async () => ({ audioSettings: snapshot }),
      })),
    };
    const service = new ArenaReadService(
      { findOne: () => ({ lean: member }) } as never,
      matches as never,
      {} as never,
      {} as never,
    );
    expect(await service.getMatchAudio(userId, matchId)).toEqual(snapshot);
    member.mockResolvedValue(null);
    matches.findById.mockClear();
    await expect(service.getMatchAudio(userId, matchId)).rejects.toThrow(
      'ARENA_MATCH_NOT_FOUND',
    );
    expect(matches.findById).not.toHaveBeenCalled();
  });
});
