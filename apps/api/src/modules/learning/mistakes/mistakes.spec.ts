import 'reflect-metadata';
import {readFileSync} from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  toeicOutcomes,
  dictationOutcomes,
  vocabularyOutcomes,
} from '@repo/shared-types/mistakes';
import { MistakesQueryDto, ReviewMistakeDto } from './mistakes.dto.js';
import { MistakesService } from './mistakes.service.js';
import { MistakeSourceController } from '../../../internal/mistake-source.controller.js';
import {
  MistakesController,
  AdminMistakesController,
} from './mistakes.controller.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

const user = '10000000-0000-4000-8000-000000000001',
  id = '10000000-0000-4000-8000-000000000002';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('F02 outcome rules', () => {
  it('preserves Vietnamese Unicode in F01/F02 translations',()=>{
    const user=JSON.parse(readFileSync(new URL('../../../../../web/locales/vi/common.json',import.meta.url),'utf8'));
    const home=JSON.parse(readFileSync(new URL('../../../../../web/locales/vi/home.json',import.meta.url),'utf8'));
    const admin=JSON.parse(readFileSync(new URL('../../../../../admin-web/locales/vi/common.json',import.meta.url),'utf8'));
    expect(user.mistakes.title).toBe('Lỗi sai của tôi');
    expect(home.recommendations.title).toBe('Hôm nay nên học gì?');
    expect(admin.recommendations.learningManagement).toBe('Quản trị học tập');
  });
  const attempt = {
    _id: id,
    status: 'FINISHED',
    answers: { [id]: 'B' },
    questionSnapshot: [
      {
        _id: id,
        part: 2,
        content: 'Question',
        correctAnswer: 'A',
        explanation: 'private',
      },
    ],
  };
  it('never projects unfinished or abandoned tests and never copies answer keys into outcomes', () => {
    expect(toeicOutcomes({ ...attempt, status: 'IN_PROGRESS' })).toEqual([]);
    expect(toeicOutcomes({ ...attempt, status: 'ABANDONED' })).toEqual([]);
    const outcomes = toeicOutcomes(attempt);
    expect(outcomes[0].wrongCount).toBe(1);
    expect(JSON.stringify(outcomes)).not.toContain('correctAnswer');
    expect(JSON.stringify(outcomes)).not.toContain('private');
    expect(
      toeicOutcomes({ ...attempt, answers: { [id]: 'A' } })[0].wrongCount,
    ).toBe(0);
    expect(toeicOutcomes({ ...attempt, answers: {} })).toEqual([]);
  });
  it('uses stable Dictation segment identities and actual wrong attempts only after completion', () => {
    const progress = {
      completed: true,
      lessonId: user,
      segmentProgress: [{ segmentIndex: 0, attempts: 3, wrongAttempts: 2 }],
    };
    const segments = [{ _id: id, order: 0, text: 'Sentence' }];
    expect(
      dictationOutcomes({ ...progress, completed: false }, segments),
    ).toEqual([]);
    expect(dictationOutcomes(progress, segments)[0]).toMatchObject({
      sourceItemId: id,
      wrongCount: 2,
      samples: 3,
    });
  });
  it('groups vocabulary mistakes once per action; HARD and unevaluated flashcards are not errors', () => {
    const actions = [
      { wordId: id, isCorrect: false, rating: 'AGAIN' },
      { wordId: id, rating: 'HARD' },
      { wordId: id },
      { wordId: id, isCorrect: true },
    ];
    expect(vocabularyOutcomes(user, actions, { [id]: 'word' })).toEqual([
      {
        sourceType: 'VOCABULARY',
        sourceItemId: id,
        sourceRefId: user,
        title: 'word',
        samples: 3,
        wrongCount: 1,
      },
    ]);
  });
});
describe('F02 validation and privacy', () => {
  it('bounds pagination/search/status and refuses identities supplied in query/body', async () => {
    expect(await validate(plainToInstance(MistakesQueryDto, {}))).toEqual([]);
    for (const patch of [
      { page: 0 },
      { page: 10001 },
      { limit: 51 },
      { q: 'x'.repeat(101) },
      { source: 'ARENA' },
      { status: 'x' },
      { userId: user },
    ]) {
      expect(
        (
          await validate(plainToInstance(MistakesQueryDto, patch), {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length,
      ).toBeGreaterThan(0);
    }
    expect(
      (await validate(plainToInstance(ReviewMistakeDto, { seenWrongCount: 0 })))
        .length,
    ).toBeGreaterThan(0);
  });
  it('uses principal identity for each user operation and ADMIN only for aggregate statistics', async () => {
    const list = vi.fn(),
      detail = vi.fn(),
      markReviewed = vi.fn();
    const controller = new MistakesController({
      list,
      detail,
      markReviewed,
    } as never);
    controller.list({ user: { _id: user } }, new MistakesQueryDto());
    controller.detail({ user: { _id: user } }, id);
    controller.reviewed({ user: { _id: user } }, id, { seenWrongCount: 2 });
    expect(list).toHaveBeenCalledWith(user, expect.anything());
    expect(detail).toHaveBeenCalledWith(user, id);
    expect(markReviewed).toHaveBeenCalledWith(user, id, 2);
    const guard = new RolesGuard(new Reflector());
    const context = (role: string) =>
      ({
        getClass: () => AdminMistakesController,
        getHandler: () => AdminMistakesController.prototype.statistics,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      }) as unknown as ExecutionContext;
    expect(guard.canActivate(context('USER'))).toBe(false);
    expect(guard.canActivate(context('ADMIN'))).toBe(true);
  });
  it('returns 404 before contacting an owner when an item is not owned', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const service = new MistakesService({
      query: async () => ({ rows: [] }),
    } as never);
    await expect(service.detail(user, id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.reviewWord(user, id)).rejects.toMatchObject({
      status: 404,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('returns an unavailable state for deleted content and distinguishes source outages', async () => {
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'a'.repeat(32));
    const service = new MistakesService({
      query: async () => ({
        rows: [{ id, sourceType: 'TOEIC', sourceItemId: id, sourceRefId: id }],
      }),
    } as never);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: { available: false } })),
      ),
    );
    expect(await service.detail(user, id)).toMatchObject({ available: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    await expect(service.detail(user, id)).rejects.toMatchObject({
      status: 503,
    });
  });
  it('never returns TEST answers from an unfinished or foreign source attempt', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'a'.repeat(32));
    const query = vi.fn(async () => ({ rows: [] }));
    const controller = new MistakeSourceController({ query } as never);
    const input = {
      userId: user,
      sourceType: 'TOEIC' as const,
      sourceItemId: id,
      sourceRefId: id,
    };
    await expect(controller.resolve('bad', input)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    expect(await controller.resolve('a'.repeat(32), input)).toEqual({
      available: false,
    });
    expect(query.mock.calls[0]).toEqual([
      expect.stringContaining("a.status IN ('FINISHED','COMPLETED')"),
      [id, user, id],
    ]);
  });
});
