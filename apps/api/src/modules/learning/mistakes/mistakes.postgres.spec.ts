import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {createConnection} from '../../../postgres/connection.js';
import { DomainOutboxService } from '../../../common/events/domain-outbox.service.js';
import { Attempt } from '../../assessment/attempts/rows/attempt.row.js';
import { Exam } from '../../assessment/exams/rows/exam.row.js';
import { Question } from '../../assessment/questions/rows/question.row.js';
import { Passage } from '../../assessment/questions/rows/passage.row.js';
import { AttemptsService } from '../../assessment/attempts/attempts.service.js';
import { DictationService } from '../../dictation/dictation.service.js';
import { DictationLesson } from '../../dictation/rows/dictation-lesson.row.js';
import { DictationSegment } from '../../dictation/rows/dictation-segment.row.js';
import { DictationProgress } from '../../dictation/rows/dictation-progress.row.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { UserWordReview } from '../reviews/rows/user-word-review.row.js';
import { Word } from '../../vocabulary/words/word.row.js';
import { LearningActivityService } from '../../learning-activity/learning-activity.service.js';
import { MistakesService } from './mistakes.service.js';
import { MistakesQueryDto } from './mistakes.dto.js';
import { MistakeSourceController } from '../../../internal/mistake-source.controller.js';

const roles = ['learning', 'assessment', 'content'] as const;
describe.runIf(
  roles.every((role) =>
    Boolean(process.env[`F01_${role.toUpperCase()}_TEST_DATABASE_URL`]),
  ),
)('F02 PostgreSQL completion → notebook', () => {
  const pools = new Map<string, Pool>();
  const user = randomUUID(),
    otherUser = randomUUID(),
    exam = randomUUID(),
    group = randomUUID(),
    question = randomUUID(),
    attemptId = randomUUID(),
    lesson = randomUUID(),
    segment = randomUUID(),
    word = randomUUID();
  let mistakes: MistakesService, activities: LearningActivityService;
  const db = (role: string) => pools.get(role)!;
  
  beforeAll(async () => {
    for (const role of roles)
      pools.set(
        role,
        new Pool({
          connectionString:
            process.env[`F01_${role.toUpperCase()}_TEST_DATABASE_URL`],
        }),
      );
    mistakes = new MistakesService(createConnection(db('learning')));
    activities = new LearningActivityService(createConnection(db('learning')),{} as never);
    await db('assessment').query(
      `INSERT INTO public.examgroups(id,name,slug,is_active) VALUES($1,$2,$2,true)`,
      [group, `f02-${group}`],
    );
    await db('assessment').query(
      `INSERT INTO public.exams(id,name,slug,type,is_active,group_id) VALUES($1,$2,$2,'TOEIC',true,$3)`,
      [exam, `f02-${exam}`, group],
    );
    await db('assessment').query(
      `INSERT INTO public.questions(id,exam_id,section,part,options,correct_answer,is_active,audio_url) VALUES($1,$2,'LISTENING',2,'[{"key":"A","text":"A"},{"key":"B","text":"B"}]','A',true,'/audio.mp3')`,
      [question, exam],
    );
    const snapshot = [
      {
        _id: question,
        part: 2,
        content: 'F02 question',
        options: [
          { key: 'A', text: 'A' },
          { key: 'B', text: 'B' },
        ],
        correctAnswer: 'A',
        explanation: 'F02 explanation',
        passages: [],
      },
    ];
    await db('assessment').query(
      `INSERT INTO public.attempts(id,user_id,exam_id,status,started_at,question_snapshot,answers,selected_parts,payload)
      VALUES($1,$2,$3,'IN_PROGRESS',now(),$4::jsonb,$5::jsonb,'[2]',$6::jsonb)`,
      [
        attemptId,
        user,
        exam,
        JSON.stringify(snapshot),
        JSON.stringify({ [question]: 'B' }),
        JSON.stringify({
          mode: 'TEST',
          examSnapshot: { _id: exam, name: 'F02', slug: `f02-${exam}` },
        }),
      ],
    );
    await db('content').query(
      `INSERT INTO public.dictationlessons(id,title,slug,status,sentence_count,full_audio_url,total_duration_ms) VALUES($1,'F02 Dictation',$2,'PUBLISHED',1,'/audio.mp3',5000)`,
      [lesson, `f02-${lesson}`],
    );
    await db('content').query(
      `INSERT INTO public.dictationsegments(id,lesson_id,"order",text,source,language,start_ms,end_ms,duration_ms) VALUES($1,$2,0,'F02 sentence','TTS','en-US',0,5000,5000)`,
      [segment, lesson],
    );
    await db('content').query(
      `INSERT INTO public.words(id,word,slug,level,parts,is_active) VALUES($1,'mistake',$2,'B1','[{"partOfSpeech":"noun","meanings":[{"definition":"an error","translation":["lỗi sai"]}]}]',true)`,
      [word, `f02-${word}`],
    );
    await db('assessment').query(`WITH authorized AS (SELECT set_config('vocalearn.publication_transition','1',true)) UPDATE public.exams SET publication_status='PUBLISHED' FROM authorized WHERE id=$1`,[exam]);
    await db('content').query(`WITH authorized AS (SELECT set_config('vocalearn.publication_transition','1',true)) UPDATE public.dictationlessons SET publication_status='PUBLISHED',status='PUBLISHED' FROM authorized WHERE id=$1`,[lesson]);
    await db('content').query(`WITH authorized AS (SELECT set_config('vocalearn.publication_transition','1',true)) UPDATE public.words SET publication_status='PUBLISHED' FROM authorized WHERE id=$1`,[word]);
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'f02-internal-test-token-'.repeat(2));
    vi.stubEnv('CONTENT_INTERNAL_URL', 'http://content');
    vi.stubEnv('ASSESSMENT_INTERNAL_URL', 'http://assessment');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const owner = new URL(url).hostname;
        const previous = process.env.SERVICE_ROLE;
        vi.stubEnv('SERVICE_ROLE', owner);
        const controller = new MistakeSourceController(
          createConnection(db(owner)),
        );
        const input = JSON.parse(String(init.body));
        const data = url.endsWith('vocabulary-titles')
          ? await controller.titles(process.env.INTERNAL_SERVICE_TOKEN!, input)
          : await controller.resolve(
              process.env.INTERNAL_SERVICE_TOKEN!,
              input,
            );
        vi.stubEnv('SERVICE_ROLE', previous ?? '');
        return new Response(JSON.stringify({ data }));
      }),
    );
  });
  afterAll(async () => {
    await Promise.all([...pools.values()].map((pool) => pool.end()));
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  async function deliver(owner: string) {
    const { rows } = await db(owner).query(
      `SELECT payload FROM public.outbox_events WHERE event_type='learning.activity.recorded.v1' AND payload->>'userId'=$1`,
      [user],
    );
    for (const { payload } of rows)
      await activities.record({
        ...payload,
        occurredAt: new Date(payload.occurredAt),
      });
    return rows;
  }
  it('grades TOEIC once with an atomic outbox, projects without duplicates, and refuses unfinished/foreign explanations', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const source = new MistakeSourceController(
      createConnection(db('assessment')),
    );
    expect(
      await source.resolve(process.env.INTERNAL_SERVICE_TOKEN!, {
        userId: user,
        sourceType: 'TOEIC',
        sourceItemId: question,
        sourceRefId: attemptId,
      }),
    ).toEqual({ available: false });
    const service = new AttemptsService(createConnection(db('assessment')),undefined,new DomainOutboxService(createConnection(db('assessment'))));
    await service.submit(user, attemptId);
    await service.submit(user, attemptId);
    expect(await deliver('assessment')).toHaveLength(1);
    await deliver('assessment');
    const list = await mistakes.list(user, new MistakesQueryDto());
    expect(list.total).toBe(1);
    expect(list.items[0].wrongCount).toBe(1);
    const detail = await mistakes.detail(user, list.items[0].id);
    expect(detail).toMatchObject({
      available: true,
      correctAnswer: 'A',
      selectedAnswer: 'B',
      explanation: 'F02 explanation',
    });
    expect(detail.actionUrl).toContain('practicePart=2');
    await expect(
      mistakes.detail(otherUser, list.items[0].id),
    ).rejects.toMatchObject({ status: 404 });
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    expect(
      await source.resolve(process.env.INTERNAL_SERVICE_TOKEN!, {
        userId: otherUser,
        sourceType: 'TOEIC',
        sourceItemId: question,
        sourceRefId: attemptId,
      }),
    ).toEqual({ available: false });
  });
  it('records Dictation only when complete and reuses the canonical segment in the retry URL', async () => {
    vi.stubEnv('SERVICE_ROLE', 'content');
    const service = new DictationService(createConnection(db('content')),{} as never,{} as never,{} as never,{} as never,new ConfigService(),undefined,new DomainOutboxService(createConnection(db('content'))));
    await service.recordAttempt(user, lesson, 0, false);
    expect(await deliver('content')).toHaveLength(0);
    await service.recordAttempt(user, lesson, 0, false);
    await service.recordAttempt(user, lesson, 0, false);
    expect(await deliver('content')).toHaveLength(1);
    await deliver('content');
    const list = await mistakes.list(user, new MistakesQueryDto());
    const item = list.items.find((row) => row.sourceType === 'DICTATION')!;
    expect(item.wrongCount).toBe(3);
    expect(await mistakes.detail(user, item.id)).toMatchObject({
      available: true,
      actionUrl: `/dictation/f02-${lesson}?segment=0`,
    });
    vi.stubEnv('SERVICE_ROLE','content');
    await service.recordAttempt(user,lesson,0,false);
    await deliver('content');
    await deliver('content');
    expect((await mistakes.owned(user,item.id)).wrongCount).toBe(4);
    const credits=await db('learning').query(`SELECT COUNT(*)::int AS count FROM public.learning_credit_ledger WHERE user_id=$1 AND source_key LIKE 'dictation:%'`,[user]);
    expect(credits.rows[0].count).toBe(1);
    const activity=await db('learning').query(`SELECT payload FROM public.learning_activities WHERE user_id=$1 AND module='DICTATION'`,[user]);
    expect(activity.rows[0].payload.outcomes).toBeUndefined();
  });
  it('records SRS AGAIN in the same transaction, and supplies one word to the existing review engine', async () => {
    vi.stubEnv('SERVICE_ROLE', 'learning');
    const service = new ReviewsService(createConnection(db('learning')),new DomainOutboxService(createConnection(db('learning'))));
    await service.recordReview(user, word, 'AGAIN');
    const list = await mistakes.list(user, new MistakesQueryDto());
    expect(new Set(list.items.map((row) => row.sourceType)).size).toBe(3);
    const item = list.items.find((row) => row.sourceType === 'VOCABULARY')!;
    expect(item.title).toBe('mistake');
    expect((await mistakes.reviewWord(user, item.id))[0].wordId._id).toBe(word);
    expect((await mistakes.detail(user, item.id)).actionUrl).toContain(
      `mistakeId=${item.id}`,
    );
    await service.recordReview(user, word, 'GOOD');
    expect((await mistakes.owned(user, item.id)).wrongCount).toBe(1);
  });
  it('filters and paginates deterministic personal results, marking only the seen count while preserving concurrent/new errors', async () => {
    const all = await mistakes.list(user, new MistakesQueryDto());
    expect(all.total).toBe(3);
    expect(all.pending).toBe(3);
    const page1 = await mistakes.list(user, {
      ...new MistakesQueryDto(),
      limit: 1,
      page: 1,
    });
    const page2 = await mistakes.list(user, {
      ...new MistakesQueryDto(),
      limit: 1,
      page: 2,
    });
    expect(page1.items[0].id).not.toBe(page2.items[0].id);
    expect((await mistakes.list(otherUser, new MistakesQueryDto())).total).toBe(
      0,
    );
    expect(
      (
        await mistakes.list(user, {
          ...new MistakesQueryDto(),
          source: 'VOCABULARY',
          q: 'MISTAKE',
        })
      ).total,
    ).toBe(1);
    expect(
      (await mistakes.list(user, { ...new MistakesQueryDto(), q: '%' })).total,
    ).toBe(0);
    const item = all.items.find((row) => row.sourceType === 'TOEIC')!;
    await expect(
      mistakes.markReviewed(otherUser, item.id, 1),
    ).rejects.toMatchObject({ status: 404 });
    expect((await mistakes.markReviewed(user, item.id, 1)).status).toBe(
      'REVIEWED',
    );
    await db('learning').query(
      `SELECT public.record_learning_outcomes($1,$2,now(),$3::jsonb)`,
      [
        user,
        'second-attempt',
        JSON.stringify([
          {
            sourceType: 'TOEIC',
            sourceItemId: question,
            sourceRefId: attemptId,
            title: 'Part 2',
            samples: 1,
            wrongCount: 1,
          },
        ]),
      ],
    );
    expect((await mistakes.markReviewed(user, item.id, 1)).status).toBe(
      'PENDING',
    );
    expect((await mistakes.owned(user, item.id)).wrongCount).toBe(2);
    await mistakes.markReviewed(user, item.id, 2);
    expect(
      (
        await mistakes.list(user, {
          ...new MistakesQueryDto(),
          status: 'REVIEWED',
        })
      ).total,
    ).toBe(1);
  });
  it('turns deleted content into an unavailable state instead of a 500', async () => {
    const list = await mistakes.list(user, {
      ...new MistakesQueryDto(),
      source: 'DICTATION',
    });
    await db('content').query(
      'UPDATE public.dictationlessons SET is_deleted=true WHERE id=$1',
      [lesson],
    );
    expect(await mistakes.detail(user, list.items[0].id)).toMatchObject({
      available: false,
    });
  });
  it('publishes aggregate error rates only at 20 distinct learners, with correct samples in the denominator', async () => {
    const content = randomUUID();
    const add = (index: number) =>
      db('learning').query(
        `SELECT public.record_learning_outcomes($1,$2,now(),$3::jsonb)`,
        [
          randomUUID(),
          `aggregate-${index}`,
          JSON.stringify([
            {
              sourceType: 'VOCABULARY',
              sourceItemId: content,
              sourceRefId: word,
              title: 'Aggregate fixture',
              samples: 1,
              wrongCount: index < 10 ? 1 : 0,
            },
          ]),
        ],
      );
    for (let index = 0; index < 19; index++) await add(index);
    expect(
      (await mistakes.statistics()).items.some(
        (row) => row.sourceItemId === content,
      ),
    ).toBe(false);
    await add(19);
    const statistics = await mistakes.statistics();
    expect(
      statistics.items.find((row) => row.sourceItemId === content),
    ).toMatchObject({
      learners: 20,
      samples: 20,
      wrongCount: 10,
      errorRate: 50,
    });
    expect(JSON.stringify(statistics)).not.toContain(user);
    expect(JSON.stringify(statistics)).not.toContain('userId');
  });
  it('applies concurrent duplicate receipts once and rolls back credit and outcomes together on invalid data', async () => {
    const owner = randomUUID(),
      item = randomUUID(),
      key = `concurrent-${randomUUID()}`;
    const outcome = {
      sourceType: 'VOCABULARY' as const,
      sourceItemId: item,
      sourceRefId: word,
      title: 'Concurrent fixture',
      samples: 1,
      wrongCount: 1,
    };
    await Promise.all(
      [1, 2, 3].map(() =>
        db('learning').query(
          'SELECT public.record_learning_outcomes($1,$2,now(),$3::jsonb)',
          [owner, key, JSON.stringify([outcome])],
        ),
      ),
    );
    expect(
      (await mistakes.list(owner, new MistakesQueryDto())).items[0].wrongCount,
    ).toBe(1);
    const invalidKey = `rollback-${randomUUID()}`;
    const logger = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      await expect(
        activities.record({
          userId: owner,
          module: 'VOCABULARY',
          type: 'VOCAB_SESSION',
          sourceKey: invalidKey,
          xp: 10,
          outcomes: [
            { ...outcome, sourceItemId: randomUUID() },
            { ...outcome, sourceItemId: randomUUID(), wrongCount: 2 },
          ],
        }),
      ).rejects.toThrow();
    } finally {
      logger.mockRestore();
    }
    expect(
      (
        await db('learning').query(
          'SELECT count(*)::int AS count FROM public.learning_credit_ledger WHERE user_id=$1 AND source_key=$2',
          [owner, invalidKey],
        )
      ).rows[0].count,
    ).toBe(0);
    expect(
      (
        await db('learning').query(
          'SELECT count(*)::int AS count FROM public.learning_item_outcomes WHERE user_id=$1 AND source_key=$2',
          [owner, invalidKey],
        )
      ).rows[0].count,
    ).toBe(0);
  });
});
