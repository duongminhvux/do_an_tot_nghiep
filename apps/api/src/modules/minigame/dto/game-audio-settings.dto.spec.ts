import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TypingRushSettingsDto } from './typing-rush-settings.dto.js';
import { MeaningTypingSettingsDto } from './meaning-typing-settings.dto.js';
import { WordShooterSettingsDto } from './word-shooter-settings.dto.js';
import {
  TYPING_RUSH_DEFAULT_SETTINGS,
  MEANING_TYPING_DEFAULT_SETTINGS,
  WORD_SHOOTER_DEFAULT_SETTINGS,
} from '../game-registry.js';

const games = [
  [TypingRushSettingsDto, TYPING_RUSH_DEFAULT_SETTINGS],
  [MeaningTypingSettingsDto, MEANING_TYPING_DEFAULT_SETTINGS],
  [WordShooterSettingsDto, WORD_SHOOTER_DEFAULT_SETTINGS],
] as const;

describe('game audio configuration', () => {
  for (const [Dto, defaults] of games) {
    describe(Dto.name, () => {
      const create = (audio: object) =>
        plainToInstance(Dto as typeof TypingRushSettingsDto, {
          ...defaults,
          ...audio,
        });
      it('accepts uploaded URLs, local paths and blank sounds, preserving inherited fields', async () => {
        const dto = create({
          backgroundMusicUrl: ' https://media.example.com/music.mp3 ',
          correctSoundUrl: '/audio/correct.wav',
          wrongSoundUrl: '',
          loseSoundUrl: 'https://media.example.com/lose.ogg',
        });
        expect(
          await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
        ).toEqual([]);
        expect(dto.backgroundMusicUrl).toBe(
          'https://media.example.com/music.mp3',
        );
        expect(dto.correctSoundUrl).toBe('/audio/correct.wav');
      });
      it('accepts a boolean audio switch and rejects coerced or null values', async () => {
        for (const audioEnabled of [true, false, undefined]) {
          expect(await validate(create({ audioEnabled }))).toEqual([]);
        }
        for (const audioEnabled of ['false', 0, null]) {
          expect(
            (await validate(create({ audioEnabled }))).some(
              (error) => error.property === 'audioEnabled',
            ),
          ).toBe(true);
        }
      });
      it('accepts configurations from before audio was introduced', async () => {
        const dto = create({
          backgroundMusicUrl: undefined,
          correctSoundUrl: undefined,
          wrongSoundUrl: undefined,
          loseSoundUrl: undefined,
        });
        expect(await validate(dto)).toEqual([]);
      });
      it.each([
        'javascript:alert(1)',
        '//untrusted.example/audio.mp3',
        'data:audio/wav;base64,AAAA',
        null,
        123,
        'https://example.com/bad path.mp3',
        '/audio/invalid\\path.mp3',
      ])('rejects invalid audio URL %s', async (url) => {
        expect(
          (await validate(create({ backgroundMusicUrl: url }))).some(
            (error) => error.property === 'backgroundMusicUrl',
          ),
        ).toBe(true);
      });
    });
  }
});
