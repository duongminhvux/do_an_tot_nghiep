import {MistakeSourceController} from '../../../internal/mistake-source.controller.js';
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { RecommendationsService } from './recommendations.service.js';
import { RecommendationSummaryController } from '../../../internal/recommendation-summary.controller.js';
import { SiteSettingsService } from '../../site-settings/site-settings.service.js';
import { DEFAULT_RECOMMENDATION_RULES } from '@repo/shared-types/recommendations';

const roles = ['learning', 'assessment', 'content', 'media-jobs'] as const;
const variable = (role: string) =>
  `F01_${role.replaceAll('-', '_').toUpperCase()}_TEST_DATABASE_URL`;
describe.runIf(roles.every((role) => Boolean(process.env[variable(role)])))(
  'F01 PostgreSQL owner integration',
  () => {
    const pools: Pool[] = [];
    const clients = new Map<string, PoolClient>();
    const userA = randomUUID(),
      userB = randomUUID(),
      group = randomUUID(),
      targetExam = randomUUID(),
      sourceExam = randomUUID();
    const targetLesson = randomUUID();
    const reviewWord=randomUUID();
    const connection = (role: string) =>
      ({
        query: (sql: string, params?: unknown[]) =>
          clients.get(role)!.query(sql, params),
      }) as never;
    beforeAll(async () => {
      for (const role of roles) {
        const pool = new Pool({
          connectionString: process.env[variable(role)],
        });
        pools.push(pool);
        const client = await pool.connect();
        clients.set(role, client);
        await client.query('BEGIN');
      }
      const learning = clients.get('learning')!,
        assessment = clients.get('assessment')!,
        content = clients.get('content')!;
      await content.query(`INSERT INTO public.words(id,word,slug,level,is_active) VALUES($1,'reviewfixture',$2,'B1',true)`,[reviewWord,`f01-${reviewWord}`]);
      await learning.query(
        `INSERT INTO public.userwordreviews (user_id, word_id, next_review_at) VALUES ($1, $2, now() - interval '1 day')`,
        [userA, reviewWord],
      );
      await assessment.query(
        `INSERT INTO public.examgroups (id, name, slug, is_active) VALUES ($1, $2, $2, true)`,
        [group, `f01-${group}`],
      );
      for (const id of [targetExam, sourceExam])
        await assessment.query(
          `INSERT INTO public.exams (id, name, slug, type, group_id, is_active) VALUES ($1, $2, $2, 'TOEIC', $3, true)`,
          [id, `f01-${id}`, group],
        );
      await assessment.query(
        `INSERT INTO public.questions (exam_id, section, part, options, correct_answer, is_active, audio_url) VALUES ($1, 'LISTENING', 2, '[{"key":"A","text":"A"}]', 'A', true, '/fixture.mp3')`,
        [targetExam],
      );
      for (let index = 0; index < 3; index++)
        await assessment.query(
          `INSERT INTO public.attempts (user_id, exam_id, status, started_at, completed_at, payload) VALUES ($1, $2, 'FINISHED', now(), now(), $3::jsonb)`,
          [
            userA,
            sourceExam,
            JSON.stringify({
              partResults: [{ part: 2, total: 10, correct: 3 }],
            }),
          ],
        );
      // An unfinished attempt with a misleading result must never enter the aggregate.
      await assessment.query(
        `INSERT INTO public.attempts (user_id, exam_id, status, started_at, payload) VALUES ($1, $2, 'IN_PROGRESS', now(), $3::jsonb)`,
        [
          userA,
          sourceExam,
          JSON.stringify({
            partResults: [{ part: 2, total: 999, correct: 999 }],
          }),
        ],
      );
      const lesson = async (id: string, status = 'PUBLISHED') =>
        content.query(
          `INSERT INTO public.dictationlessons (id, title, slug, status, sentence_count, full_audio_url, total_duration_ms) VALUES ($1, $2, $2, $3, 5, '/fixture.mp3', 60000)`,
          [id, `f01-${id}`, status],
        );
      await lesson(targetLesson);
      await lesson(randomUUID(), 'DRAFT');
      for (let index = 0; index < 3; index++) {
        const id = randomUUID();
        await lesson(id);
        await content.query(
          `INSERT INTO public.dictationprogresses (user_id, lesson_id, completed, last_practiced_at, segment_progress) VALUES ($1, $2, true, now(), $3::jsonb)`,
          [
            userA,
            id,
            JSON.stringify(
              Array.from({ length: 5 }, (_, segmentIndex) => ({
                segmentIndex,
                correct: true,
                firstTryCorrect: segmentIndex === 0,
              })),
            ),
          ],
        );
      }
      await clients.get('assessment')!.query(`WITH authorized AS (SELECT set_config('vocalearn.publication_transition','1',true)) UPDATE public.exams SET publication_status='PUBLISHED' FROM authorized WHERE id=ANY($1::uuid[])`,[[targetExam,sourceExam]]);
    await clients.get('content')!.query(`WITH authorized AS (SELECT set_config('vocalearn.publication_transition','1',true)) UPDATE public.dictationlessons SET publication_status='PUBLISHED',status='PUBLISHED' FROM authorized WHERE id=$1`,[targetLesson]);
    await clients.get('content')!.query(`WITH authorized AS (SELECT set_config('vocalearn.publication_transition','1',true)) UPDATE public.words SET publication_status='PUBLISHED' FROM authorized WHERE id=$1`,[reviewWord]);
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'f01-test-token-'.repeat(3));
      for (const role of roles)
        vi.stubEnv(
          `${role.replaceAll('-', '_').toUpperCase()}_INTERNAL_URL`,
          `http://${role}`,
        );
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string,init?:RequestInit) => {
          const parsed = new URL(url),
            role = parsed.hostname;
          vi.stubEnv('SERVICE_ROLE', role);
          const controller = new RecommendationSummaryController(
            connection(role),
          );
          const path = parsed.pathname.split('/').at(-1)!;
          const data =
            path === 'vocabulary-titles' ? await new MistakeSourceController(connection(role)).titles(process.env.INTERNAL_SERVICE_TOKEN!,JSON.parse(String(init?.body))) : path === 'rules'
              ? await controller.rules(process.env.INTERNAL_SERVICE_TOKEN!)
              : await controller.summary(
                  process.env.INTERNAL_SERVICE_TOKEN!,
                  path,
                );
          return new Response(JSON.stringify({ data }));
        }),
      );
    });
    afterAll(async () => {
      for (const client of clients.values()) {
        await client.query('ROLLBACK');
        client.release();
      }
      await Promise.all(pools.map((pool) => pool.end()));
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });
    it('round trips configuration, aggregates only completed personal results, and refreshes targets after completion', async () => {
      const settings = new SiteSettingsService(connection('media-jobs'));
      await settings.saveRecommendations({ ...DEFAULT_RECOMMENDATION_RULES });
      const service = new RecommendationsService(connection('learning'));
      const result = await service.list(userA, 'vi');
      expect(result.items.map((item) => item.source)).toEqual([
        'vocabulary',
        'toeic',
        'dictation',
      ]);
      expect(result.items[1].reason).toContain('30%');
      expect(result.items[1].actionUrl).toContain('practicePart=2');
      expect(result.items[2].actionUrl).toBe(`/dictation/f01-${targetLesson}`);
      expect((await service.list(userB, 'vi')).state).toBe('insufficient_data');
      await clients
        .get('assessment')!
        .query(
          `INSERT INTO public.attempts (user_id, exam_id, status, started_at, completed_at) VALUES ($1, $2, 'FINISHED', now(), now())`,
          [userA, targetExam],
        );
      await clients
        .get('content')!
        .query(
          `INSERT INTO public.dictationprogresses (user_id, lesson_id, completed, last_practiced_at) VALUES ($1, $2, true, now())`,
          [userA, targetLesson],
        );
      expect(
        (await service.list(userA, 'vi')).items.map((item) => item.source),
      ).toEqual(['vocabulary']);
      await settings.saveRecommendations({
        ...DEFAULT_RECOMMENDATION_RULES,
        enabled: false,
      });
      expect((await service.list(userA, 'vi')).state).toBe('disabled');
    });
  },
);
