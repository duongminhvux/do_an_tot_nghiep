import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { createConnection } from '../../../../postgres/connection.js';
import { DomainOutboxService } from '../../../../common/events/domain-outbox.service.js';
import { PublicationService } from '../../../publication/publication.service.js';
import { AttemptsService } from '../../attempts/attempts.service.js';
import { ExamMode } from '../../attempts/attempt.types.js';
import { ExamCommunityService } from './exam-community.service.js';

describe.runIf(Boolean(process.env.F01_ASSESSMENT_TEST_DATABASE_URL))(
  'TOEIC community PostgreSQL',
  () => {
    const pool = new Pool({
      connectionString: process.env.F01_ASSESSMENT_TEST_DATABASE_URL,
    });
    const db = createConnection(pool),
      community = new ExamCommunityService(db),
      publication = new PublicationService(db);
    const exam = randomUUID(),
      other = randomUUID(),
      actor = randomUUID(),
      first = randomUUID(),
      second = randomUUID(),
      third = randomUUID(),
      banned = randomUUID();
    const q1 = randomUUID(),
      q2 = randomUUID();
    let revision: number, root: string, reply: string;
    const snapshot = [
      { _id: q1, part: 1 },
      { _id: q2, part: 5 },
    ];
    async function result(
      user: string,
      correct: number,
      duration: number,
      patch: Record<string, unknown> = {},
    ) {
      const value = {
        mode: 'TEST',
        status: 'FINISHED',
        total: 2,
        parts: [1, 5],
        questions: snapshot,
        revision,
        version: 1,
        ...patch,
      };
      return pool.query(
        `INSERT INTO public.attempts(user_id,exam_id,mode,status,started_at,completed_at,total_questions,correct_answers,duration_spent,result_version,selected_parts,question_snapshot,payload)
      VALUES($1,$2,$3,$4,now()-interval '3 minutes',now(),$5,$6,$7,$8,$9,$10,$11)`,
        [
          user,
          exam,
          value.mode,
          value.status,
          value.total,
          correct,
          duration,
          value.version,
          JSON.stringify(value.parts),
          JSON.stringify(value.questions),
          JSON.stringify({ examPublicationRevision: value.revision }),
        ],
      );
    }
    beforeAll(async () => {
      vi.stubEnv('SERVICE_ROLE', 'assessment');
      for (const id of [exam, other])
        await pool.query(
          `INSERT INTO public.exams(id,name,slug,type,is_active) VALUES($1,$2,$2,'TOEIC',true)`,
          [id, `community-${id}`],
        );
      for (const [id, part] of [
        [q1, 1],
        [q2, 5],
      ] as const)
        await pool.query(
          `INSERT INTO public.questions(id,exam_id,section,part,content,options,correct_answer,is_active,audio_url,image_url)
      VALUES($1,$2,$3,$4,$5,'[{"key":"A","text":"One"},{"key":"B","text":"Two"},{"key":"C","text":"Three"},{"key":"D","text":"Four"}]','A',true,$6,$7)`,
          [
            id,
            exam,
            part === 1 ? 'LISTENING' : 'READING',
            part,
            `Question ${id}`,
            part === 1 ? '/media/listen.wav' : null,
            part === 1 ? '/media/image.jpg' : null,
          ],
        );
      await publication.validate('exams', exam, actor, 'en');
      await publication.publish('exams', exam, actor, 'en');
      revision = (await publication.info('exams', exam)).publicationRevision;
      for (const [id, name] of [
        [first, 'First'],
        [second, 'Second'],
        [third, 'Third'],
        [banned, 'Banned'],
      ])
        await pool.query(
          `INSERT INTO public.identity_profiles(id,username,is_banned) VALUES($1,$2,$3)`,
          [id, name, id === banned],
        );
      // Second exam is deliberately published only as an isolated test fixture.
      await pool.query(
        `WITH authorized AS (SELECT set_config('vocalearn.publication_transition','1',true)) UPDATE public.exams SET publication_status='PUBLISHED' FROM authorized WHERE id=$1`,
        [other],
      );
    });
    afterAll(async () => {
      await pool.end();
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });
    it('ranks each learner once by best full TEST, never practice, partial, unfinished, banned or stale results', async () => {
      await result(first, 1, 200);
      await result(first, 2, 300);
      await result(first, 2, 250);
      await result(second, 2, 100);
      await result(third, 2, 1, { mode: 'PRACTICE' });
      await result(third, 1, 1, {
        total: 1,
        parts: [5],
        questions: [snapshot[1]],
      });
      await result(third, 2, 1, { status: 'IN_PROGRESS' });
      await result(third, 2, 1, { revision: revision - 1 });
      await result(third, 2, 1, { version: null });
      await result(third, 2, 1, { questions: { malformed: true } });
      await result(banned, 2, 1);
      const ranks = await community.leaderboard(exam, first);
      expect(ranks.total).toBe(2);
      expect(ranks.items.map((r: any) => r.userId)).toEqual([second, first]);
      expect(ranks.mine).toMatchObject({
        rank: 2,
        correct: 2,
        durationSpent: 250,
        isMe: true,
      });
      expect(JSON.stringify(ranks)).not.toMatch(
        /questionSnapshot|answers|listening_result|reading_result|email/,
      );
      expect((await community.leaderboard(exam, first, 2)).items).toEqual([]);
    });
    it('includes a real server-created and graded full TEST attempt without accepting a client score', async () => {
      const student = randomUUID();
      const attempts = new AttemptsService(
        db,
        undefined,
        new DomainOutboxService(db),
      );
      const created = await attempts.create(student, {
        examId: exam,
        mode: ExamMode.TEST,
        selectedParts: [1, 5],
      });
      await attempts.saveAnswer(student, created._id, {
        questionId: q1,
        answer: 'A',
      });
      await attempts.saveAnswer(student, created._id, {
        questionId: q2,
        answer: 'A',
      });
      await attempts.submit(student, created._id);
      expect((await community.leaderboard(exam, student)).mine).toMatchObject({
        correct: 2,
        total: 2,
        isMe: true,
      });
    });
    it('resolves existing users through the bounded Identity lookup and gracefully falls back on outage', async () => {
      vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'community-lookup-token-'.repeat(2));
      const fetcher = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: { [first]: 'Current First', [second]: 'Current Second' },
            }),
          ),
      );
      vi.stubGlobal('fetch', fetcher);
      try {
        const ranks = await community.leaderboard(exam, first);
        expect(ranks.mine).toMatchObject({ username: 'Current First' });
        const requestBody = JSON.parse(
          String(
            (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body,
          ),
        );
        expect(requestBody.ids.length).toBeLessThanOrEqual(21);
        fetcher.mockRejectedValueOnce(new Error('Identity unavailable'));
        expect((await community.leaderboard(exam, first)).mine).toMatchObject({
          username: 'First',
        });
      } finally {
        vi.unstubAllGlobals();
        vi.stubEnv('INTERNAL_SERVICE_TOKEN', '');
      }
    });
    it('stores emoji/plain text and supports replies to replies inside the same exam thread', async () => {
      root = (
        await community.post(exam, first, {
          body: 'Bài này hay 😊 <script>alert(1)</script>',
        })
      ).id;
      reply = (
        await community.post(exam, second, {
          body: 'Đồng ý 👍',
          replyToId: root,
        })
      ).id;
      await community.post(exam, third, {
        body: 'Cảm ơn ❤️',
        replyToId: reply,
      });
      const roots = await community.comments(exam, first);
      expect(roots.items.find((i: any) => i.id === root)).toMatchObject({
        body: 'Bài này hay 😊 <script>alert(1)</script>',
        username: 'First',
        isMine: true,
        replyCount: 2,
      });
      const replies = await community.comments(exam, third, 1, root);
      expect(replies.total).toBe(2);
      expect(replies.items[0]).toMatchObject({
        rootId: root,
        replyToId: reply,
        replyToName: 'Second',
        body: 'Cảm ơn ❤️',
      });
      await expect(
        community.post(other, third, { body: 'Wrong exam', replyToId: root }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        community.comments(other, first, 1, root),
      ).rejects.toMatchObject({ status: 404 });
    });
    it('reaction PUT is idempotent, changeable and removable under concurrent requests', async () => {
      await Promise.all(
        Array.from({ length: 5 }, () =>
          community.react(exam, root, second, '👍'),
        ),
      );
      let item = (await community.comments(exam, second)).items.find(
        (i: any) => i.id === root,
      );
      expect(item.reactions).toEqual({ '👍': 1 });
      expect(item.myReaction).toBe('👍');
      await community.react(exam, root, second, '❤️');
      await community.react(exam, root, third, '❤️');
      item = (await community.comments(exam, first)).items.find(
        (i: any) => i.id === root,
      );
      expect(item.reactions).toEqual({ '❤️': 2 });
      expect(item.myReaction).toBeNull();
      await community.react(exam, root, third, null);
      expect(
        (await community.comments(exam, third)).items.find(
          (i: any) => i.id === root,
        ).reactions,
      ).toEqual({ '❤️': 1 });
      await expect(
        community.react(other, root, second, '👍'),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        community.react(exam, root, second, 'unsupported'),
      ).rejects.toMatchObject({ status: 400 });
    });
    it('only owner/admin may delete; tombstones preserve replies and remove reactions', async () => {
      await expect(community.remove(exam, root, second)).rejects.toMatchObject({
        status: 403,
      });
      await community.remove(exam, root, first);
      const tombstone = (await community.comments(exam, first)).items.find(
        (i: any) => i.id === root,
      );
      expect(tombstone).toMatchObject({
        body: null,
        deleted: true,
        authorId: null,
        username: null,
        isMine: false,
        reactions: {},
        replyCount: 2,
      });
      expect((await community.comments(exam, second, 1, root)).total).toBe(2);
      await expect(
        community.react(exam, root, second, '👍'),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        community.post(exam, second, { body: 'Late reply', replyToId: root }),
      ).rejects.toMatchObject({ status: 404 });
      await community.remove(exam, reply, actor, true);
    });
    it('rate limit remains atomic across concurrent posts and deleted comments do not bypass it', async () => {
      const sender = randomUUID();
      const sent = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) =>
          community.post(exam, sender, { body: `Comment ${i}` }),
        ),
      );
      expect(sent.filter((v) => v.status === 'fulfilled')).toHaveLength(10);
      expect(
        sent
          .filter((v) => v.status === 'rejected')
          .every((v) => v.status === 'rejected' && v.reason.status === 429),
      ).toBe(true);
      const one = sent.find(
        (v) => v.status === 'fulfilled',
      ) as PromiseFulfilledResult<{ id: string }>;
      await community.remove(exam, one.value.id, sender);
      await expect(
        community.post(exam, sender, { body: 'Again' }),
      ).rejects.toMatchObject({ status: 429 });
    });
    it('paginates root comments and prevents reading/posting to drafts or deleted exams', async () => {
      await pool.query(
        `INSERT INTO public.exam_comments(exam_id,author_id,body) SELECT $1,gen_random_uuid(),'Paged comment '||n FROM generate_series(1,25) n`,
        [exam],
      );
      const page = await community.comments(exam, first);
      const next = await community.comments(exam, first, 2);
      expect(page.items).toHaveLength(20);
      expect(next.items.length).toBeGreaterThan(0);
      expect(
        new Set([...page.items, ...next.items].map((item) => item.id)).size,
      ).toBe(page.total);
      expect((await community.comments(exam, first, 3)).items).toEqual([]);
      const target = page.items.find((item) => !item.deleted)!;
      await pool.query(
        `INSERT INTO public.exam_comments(exam_id,author_id,body,root_id,reply_to_id) SELECT $1,gen_random_uuid(),'Paged reply '||n,$2,$2 FROM generate_series(1,25) n`,
        [exam, target.id],
      );
      expect(
        (await community.comments(exam, first, 1, target.id)).items,
      ).toHaveLength(20);
      expect(
        (await community.comments(exam, first, 2, target.id)).items.length,
      ).toBeGreaterThan(0);
      expect((await community.comments(other, first)).items).toEqual([]);
      await publication.unpublish('exams', exam, actor);
      await expect(community.leaderboard(exam, first)).rejects.toMatchObject({
        status: 404,
      });
      await expect(community.comments(exam, first)).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        community.post(exam, first, { body: 'hidden' }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        community.comments(randomUUID(), first),
      ).rejects.toMatchObject({ status: 404 });
    });
  },
);
