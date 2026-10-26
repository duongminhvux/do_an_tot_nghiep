import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import {
  buildRecommendations,
  DEFAULT_RECOMMENDATION_RULES as defaults,
  recommendationScenario,
  RECOMMENDATION_RULES_ID,
} from '@repo/shared-types/recommendations';
import { RecommendationRulesDto } from './recommendation-rules.dto.js';
import { RecommendationsService } from './recommendations.service.js';
import {
  RecommendationLanguageDto,
  RecommendationsController,
} from './recommendations.controller.js';
import { RecommendationSummaryController } from '../../../internal/recommendation-summary.controller.js';
import {
  AdminSiteSettingsController,
  RecommendationPreviewQueryDto,
} from '../../site-settings/site-settings.controller.js';
import { SiteSettingsService } from '../../site-settings/site-settings.service.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

const userA = '10000000-0000-4000-8000-000000000001';
const userB = '10000000-0000-4000-8000-000000000002';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('F01 recommendation business rules', () => {
  it.each(['new', 'little'] as const)(
    'offers a starter without claiming a weakness for %s data',
    (scenario) => {
      const result = buildRecommendations(
        recommendationScenario(scenario),
        defaults,
      );
      expect(result.state).toBe('insufficient_data');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('starter');
      expect(result.items[0].actionUrl).toBe('/vocabulary');
    },
  );
  it('ranks due review first and returns three explained actions across modules', () => {
    const result = buildRecommendations(
      recommendationScenario('progress'),
      defaults,
    );
    expect(result.items.map((item) => item.source)).toEqual([
      'vocabulary',
      'toeic',
      'dictation',
    ]);
    expect(
      result.items.every((item) => item.reason && item.estimatedMinutes > 0),
    ).toBe(true);
    const largeReview = buildRecommendations(
      { dueCount: 120, parts: [], dictation: null },
      defaults,
      'en',
    );
    expect(largeReview.items[0].title).toBe('Review 50 due words');
    expect(largeReview.items[0].reason).toContain('120');
  });
  it('honors enabled sources, source order, card limit and the due priority switch', () => {
    const rules = {
      ...defaults,
      maxSuggestions: 1,
      prioritizeDue: false,
      sources: ['dictation', 'toeic', 'vocabulary'] as const,
    };
    expect(
      buildRecommendations(recommendationScenario('progress'), {
        ...rules,
        sources: [...rules.sources],
      }).items[0].source,
    ).toBe('dictation');
    expect(
      buildRecommendations(recommendationScenario('progress'), {
        ...defaults,
        sources: [],
      }).state,
    ).toBe('disabled');
    expect(
      buildRecommendations(recommendationScenario('progress'), {
        ...defaults,
        enabled: false,
      }).items,
    ).toEqual([]);
  });
  it('requires both sample and question thresholds, ignores missing targets, and selects only one weakest TOEIC Part', () => {
    const input = {
      dueCount: 0,
      dictation: null,
      parts: [
        {
          part: 2,
          samples: 5,
          total: 30,
          correct: 12,
          actionUrl: '/toeic/g/e?practicePart=2',
        },
        {
          part: 5,
          samples: 5,
          total: 30,
          correct: 3,
          actionUrl: '/toeic/g/e?practicePart=5',
        },
      ],
    };
    expect(
      buildRecommendations(input, defaults).items.map((item) => item.id),
    ).toEqual(['toeic-part-5']);
    expect(
      buildRecommendations(input, { ...defaults, minSamples: 6 }).state,
    ).toBe('insufficient_data');
    expect(
      buildRecommendations(input, { ...defaults, minQuestions: 31 }).state,
    ).toBe('insufficient_data');
    expect(
      buildRecommendations(
        {
          ...input,
          parts: input.parts.map((p) => ({ ...p, actionUrl: null })),
        },
        defaults,
      ).items[0].id,
    ).toBe('maintenance');
  });
  it('changes recommendations after improved results and localizes output', () => {
    const input = recommendationScenario('progress');
    const result = buildRecommendations(
      {
        ...input,
        dueCount: 0,
        parts: input.parts.map((p) => ({ ...p, correct: p.total })),
        dictation: null,
      },
      defaults,
      'en',
    );
    expect(result.state).toBe('ready');
    expect(result.items[0].title).toBe('Keep up your study routine');
  });
});

describe('F01 configuration and access boundaries', () => {
  it('accepts defaults and rejects out-of-range, duplicate and unknown input', async () => {
    expect(
      await validate(plainToInstance(RecommendationRulesDto, defaults)),
    ).toEqual([]);
    for (const patch of [
      { maxSuggestions: 4 },
      { maxSuggestions: 0 },
      { minSamples: 1 },
      { minQuestions: 0 },
      { weakAccuracy: 100 },
      { minSamples: 2.5 },
      { sources: ['toeic', 'toeic'] },
      { sources: ['arena'] },
      { userId: userB },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(RecommendationRulesDto, { ...defaults, ...patch }),
            { whitelist: true, forbidNonWhitelisted: true },
          )
        ).length,
      ).toBeGreaterThan(0);
    }
    expect(
      (
        await validate(
          plainToInstance(RecommendationPreviewQueryDto, {
            scenario: 'user-history',
            lang: 'vi',
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(RecommendationLanguageDto, {
            lang: 'vi',
            userId: userB,
          }),
          { whitelist: true, forbidNonWhitelisted: true },
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('persists separate settings without changing website branding; defaults before first save', async () => {
    let payload: unknown;
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('INSERT')) payload = JSON.parse(params[1] as string);
      return { rows: payload ? [{ payload }] : [] };
    });
    const service = new SiteSettingsService({ query } as never);
    expect(await service.readRecommendations()).toEqual(defaults);
    const rules = { ...defaults, maxSuggestions: 2 };
    await service.saveRecommendations(rules);
    expect(await service.readRecommendations()).toEqual(rules);
    expect(
      query.mock.calls.every((call) => call[1][0] === RECOMMENDATION_RULES_ID),
    ).toBe(true);
  });
  it('requires ADMIN for config and preview; learner endpoint is not public and derives identity from auth', async () => {
    const guard = new RolesGuard(new Reflector());
    for (const method of [
      'readRecommendations',
      'saveRecommendations',
      'previewRecommendations',
    ] as const) {
      const context = (role?: string) =>
        ({
          getClass: () => AdminSiteSettingsController,
          getHandler: () => AdminSiteSettingsController.prototype[method],
          switchToHttp: () => ({
            getRequest: () => ({ user: role ? { role } : undefined }),
          }),
        }) as unknown as ExecutionContext;
      expect(guard.canActivate(context('ADMIN'))).toBe(true);
      expect(guard.canActivate(context('USER'))).toBe(false);
      expect(guard.canActivate(context())).toBe(false);
    }
    expect(
      new Reflector().getAllAndOverride(IS_PUBLIC_KEY, [
        RecommendationsController.prototype.list,
        RecommendationsController,
      ]),
    ).toBeUndefined();
    const list = vi.fn();
    await new RecommendationsController({ list } as never).list(
      { user: { _id: userA } },
      { lang: 'vi', userId: userB } as never,
    );
    expect(list).toHaveBeenCalledWith(userA, 'vi');
  });
  it('preview reads only built-in scenarios, never queries personal data', () => {
    const controller = new AdminSiteSettingsController({} as never);
    expect(
      controller.previewRecommendations(
        { ...defaults },
        { scenario: 'progress', lang: 'en' },
      ).items,
    ).toHaveLength(3);
  });
  it('denies owner summaries without the internal token and scopes SQL to the selected user', async () => {
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'a'.repeat(32));
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const query = vi.fn(async () => ({ rows: [] }));
    const controller = new RecommendationSummaryController({ query } as never);
    await expect(controller.summary('bad', userA)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    await controller.summary('a'.repeat(32), userA);
    expect(query.mock.calls[0]).toEqual([
      expect.stringContaining("status IN ('FINISHED', 'COMPLETED')"),
      [userA],
    ]);
    const sql = (query.mock.calls[0] as unknown as [string])[0];
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain("interval '1 day'");
    expect(sql).not.toContain('question_snapshot');
    vi.stubEnv('SERVICE_ROLE', 'identity');
    await expect(controller.summary('a'.repeat(32), userA)).rejects.toThrow();
  });
  it('scopes Dictation results and excludes unpublished lessons and recently completed targets', async () => {
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'a'.repeat(32));
    vi.stubEnv('SERVICE_ROLE', 'content');
    const query = vi.fn(async () => ({ rows: [{}] }));
    await new RecommendationSummaryController({ query } as never).summary(
      'a'.repeat(32),
      userB,
    );
    expect(query.mock.calls[0]).toEqual([
      expect.stringContaining("l.status = 'PUBLISHED'"),
      [userB],
    ]);
  });
});

describe('F01 aggregation and source outages', () => {
  it('binds only the current user in SQL and owner requests, with no shared cache', async () => {
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'a'.repeat(32));
    const query = vi.fn(async () => ({ rows: [{ wordId: userA }] }));
    const fetchMock = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify({
            data: url.endsWith('vocabulary-titles') ? {[userA]:'word'} : url.endsWith('/rules')
              ? defaults
              : url.includes('assessment')
                ? recommendationScenario('progress').parts
                : recommendationScenario('progress').dictation,
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new RecommendationsService({ query } as never);
    expect((await service.list(userA, 'vi')).items).toHaveLength(3);
    await service.list(userB, 'en');
    expect(query.mock.calls).toEqual([
      [expect.stringContaining('user_id = $1'), [userA]],
      [expect.any(String), [userB]],
    ]);
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith('/rules')),
    ).toHaveLength(2);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith(userA))).toBe(
      true,
    );
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith(userB))).toBe(
      true,
    );
  });
  it('preserves useful recommendations on a partial outage; fails explicitly when all sources fail', async () => {
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'a'.repeat(32));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('vocabulary-titles') ? new Response(JSON.stringify({[userA]:'word'})) : url.endsWith('/rules')
          ? new Response(JSON.stringify(defaults))
          : new Response('', { status: 503 }),
      ),
    );
    const service = new RecommendationsService({
      query: async () => ({ rows: [{ wordId: userA }] }),
    } as never);
    expect(await service.list(userA, 'vi')).toMatchObject({
      state: 'ready',
      unavailableSources: ['toeic', 'dictation'],
    });
    await expect(
      new RecommendationsService({
        query: async () => {
          throw new Error('offline');
        },
      } as never).list(userA, 'vi'),
    ).rejects.toThrow();
  });
  it('never uses default rules to mask a settings outage', async () => {
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'a'.repeat(32));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    const query = vi.fn();
    await expect(
      new RecommendationsService({ query } as never).list(userA, 'vi'),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
