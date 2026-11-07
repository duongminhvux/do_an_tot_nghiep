import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { createConnection } from '../../postgres/connection.js';
import { SqlRecords } from '../../postgres/records.js';
import { sql } from '../../postgres/sql.js';
import { PublicationService } from './publication.service.js';
import { publicationScope } from './publication-scope.js';
import { AttemptsService } from '../assessment/attempts/attempts.service.js';
import { ExamsService } from '../assessment/exams/exams.service.js';
import { DomainOutboxService } from '../../common/events/domain-outbox.service.js';
import { ExamMode } from '../assessment/attempts/attempt.types.js';

/**
 * Phase 2 — validated Show/Hide without a manual review step.
 * Runs only against disposable databases (F01_*_TEST_DATABASE_URL).
 */
describe.runIf(
  Boolean(
    process.env.F01_ASSESSMENT_TEST_DATABASE_URL &&
      process.env.F01_CONTENT_TEST_DATABASE_URL,
  ),
)('Content visibility (Show / Hide)', () => {
  const assessment = new Pool({ connectionString: process.env.F01_ASSESSMENT_TEST_DATABASE_URL });
  const content = new Pool({ connectionString: process.env.F01_CONTENT_TEST_DATABASE_URL });
  const exams = new PublicationService(createConnection(assessment));
  const lessons = new PublicationService(createConnection(content));
  const actor = randomUUID();
  const learner = randomUUID();
  const options = '[{"key":"A","text":"one"},{"key":"B","text":"two"},{"key":"C","text":"three"},{"key":"D","text":"four"}]';
  let examService: ExamsService;
  let attempts: AttemptsService;

  const learnerSees = (pool: Pool, table: string, id: string) =>
    publicationScope.run(true, () =>
      new SqlRecords<any>(createConnection(pool), table).one(
        sql`id=${id}::uuid AND publication_status='PUBLISHED' AND is_active IS NOT FALSE AND is_deleted IS NOT TRUE`,
      ),
    );
  const audit = async (pool: Pool, id: string) =>
    (await pool.query('SELECT action FROM public.content_publication_audit WHERE resource_id=$1 ORDER BY created_at,id', [id])).rows.map((r) => r.action);
  async function completeExam(name: string) {
    const id = randomUUID();
    await assessment.query(`INSERT INTO public.exams(id,name,slug,type,is_active) VALUES($1,$2,$2,'TOEIC',true)`, [id, `${name}-${id}`]);
    const question = randomUUID();
    await assessment.query(
      `INSERT INTO public.questions(id,exam_id,section,part,content,options,correct_answer,is_active) VALUES($1,$2,'READING',5,'Pick ____.',$3,'A',true)`,
      [question, id, options],
    );
    return { id, question };
  }

  beforeAll(() => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const i18n = { t: async (key: string) => key } as any;
    examService = new ExamsService(
      createConnection(assessment),
      i18n,
      new DomainOutboxService(createConnection(assessment)),
      exams,
    );
    attempts = new AttemptsService(createConnection(assessment), undefined, new DomainOutboxService(createConnection(assessment)));
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await Promise.all([assessment.end(), content.end()]);
  });

  it('1. creating complete content with "show" selected makes it visible in the same flow', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const { id } = await completeExam('valid');
    // Second half of createWithVisibility(): the content is already saved.
    const result = await exams.applyRequestedVisibility('exams', id, actor, true, 'vi');
    expect(result).toEqual({ visible: true, issues: [] });
    expect((await exams.info('exams', id)).visibility).toBe('VISIBLE');
    expect(await learnerSees(assessment, 'exams', id)).not.toBeNull();
    expect(await audit(assessment, id)).toEqual(['PUBLISH']);
  });

  it('2. creating incomplete content saves it hidden and returns the exact issues', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const created: any = await examService.createWithVisibility(
      { name: `incomplete-${randomUUID()}`, type: 'TOEIC', publish: true } as any,
      actor,
    );
    expect(created.publication.visible).toBe(false);
    expect(created.publication.issues.map((i: any) => i.code)).toContain('EMPTY');
    expect(created.visibility).toBe('INCOMPLETE');
    expect(created.publish).toBeUndefined();
    const row = (await assessment.query('SELECT publication_status,payload FROM public.exams WHERE id=$1', [created._id])).rows[0];
    expect(row.publication_status).toBe('DRAFT');
    expect(row.payload.publish).toBeUndefined();
    expect(await learnerSees(assessment, 'exams', created._id)).toBeNull();
    expect(await audit(assessment, created._id)).toEqual(['VALIDATE']);
  });

  it('3. creating complete content with "hide" selected keeps it hidden but valid', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const { id } = await completeExam('hidden');
    expect(await exams.applyRequestedVisibility('exams', id, actor, false)).toEqual({ visible: false, issues: [] });
    const info = await exams.info('exams', id);
    expect(info.publicationStatus).toBe('DRAFT');
    expect(info.visibility).toBe('HIDDEN');
    expect(info.currentIssues).toEqual([]);
    expect(await learnerSees(assessment, 'exams', id)).toBeNull();
    expect(await audit(assessment, id)).toEqual([]);
  });

  it('4. "Show" on valid hidden content publishes it in one step (no separate review) and re-enables a switched-off exam', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const { id } = await completeExam('show');
    await assessment.query('UPDATE public.exams SET is_active=false WHERE id=$1', [id]);
    const shown = await exams.publish('exams', id, actor, 'vi');
    expect(shown).toMatchObject({ publicationStatus: 'PUBLISHED', visibility: 'VISIBLE', publishedBy: actor, isActive: true });
    expect(await learnerSees(assessment, 'exams', id)).not.toBeNull();
    const [listed]: any[] = (await examService.findAll({ publicationStatus: 'PUBLISHED', q: id } as any)).data;
    expect(listed.visibility).toBe('VISIBLE');
  });

  it('5. "Show" is refused for incomplete content, with issues that point at the question', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const { id, question } = await completeExam('broken');
    await assessment.query(
      `INSERT INTO public.questions(exam_id,section,part,content,options,correct_answer,is_active) VALUES($1,'LISTENING',1,'Photo',$2,'A',true)`,
      [id, options],
    );
    const error: any = await exams.publish('exams', id, actor, 'vi').catch((e) => e);
    expect(error.status).toBe(409);
    const issues = error.getResponse().issues;
    expect(issues.map((i: any) => i.code)).toEqual(expect.arrayContaining(['IMAGE_REQUIRED', 'AUDIO_REQUIRED']));
    expect(issues.every((i: any) => i.path.startsWith('questions.') && i.path !== `questions.${question}`)).toBe(true);
    const info = await exams.info('exams', id);
    expect(info.publicationStatus).toBe('DRAFT');
    expect(info.visibility).toBe('INCOMPLETE');
    expect(await learnerSees(assessment, 'exams', id)).toBeNull();
    expect(await audit(assessment, id)).toEqual(['VALIDATE']);
  });

  it('6. editing visible content hides it at once; one "Show" republishes the edit', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const { id, question } = await completeExam('edit');
    await exams.publish('exams', id, actor);
    await assessment.query('UPDATE public.questions SET content=$2 WHERE id=$1', [question, 'Edited ____.']);
    expect(await learnerSees(assessment, 'exams', id)).toBeNull();
    expect((await exams.info('exams', id)).visibility).toBe('HIDDEN');
    await exams.publish('exams', id, actor);
    const preview: any = await exams.preview('exams', id);
    expect(preview.questions[0].content).toBe('Edited ____.');
    expect(await learnerSees(assessment, 'exams', id)).not.toBeNull();
  });

  it('7. "Hide" stops learner access, keeps the validation and is audited', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const { id } = await completeExam('hide');
    await exams.publish('exams', id, actor);
    const hidden = await exams.unpublish('exams', id, actor);
    expect(hidden).toMatchObject({ publicationStatus: 'IN_REVIEW', visibility: 'HIDDEN' });
    expect(hidden.publicationValidation?.issues).toEqual([]);
    expect(await learnerSees(assessment, 'exams', id)).toBeNull();
    expect(await audit(assessment, id)).toEqual(['PUBLISH', 'UNPUBLISH']);
    const [listed]: any[] = (await examService.findAll({ publicationStatus: 'NOT_PUBLISHED', q: id } as any)).data;
    expect(listed.visibility).toBe('HIDDEN');
  });

  it('8a. learner TOEIC history is unchanged after the admin edits the answer key', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    const { id, question } = await completeExam('history');
    await exams.publish('exams', id, actor);
    const attempt = await attempts.create(learner, { examId: id, mode: ExamMode.PRACTICE, selectedParts: [5] });
    await assessment.query(`UPDATE public.questions SET content='Changed', correct_answer='B' WHERE id=$1`, [question]);
    await exams.publish('exams', id, actor);
    const snapshot = (await assessment.query('SELECT question_snapshot FROM public.attempts WHERE id=$1', [attempt._id])).rows[0];
    const stored = (snapshot.question_snapshot ?? []).find((q: any) => q._id === question);
    expect(stored).toMatchObject({ content: 'Pick ____.', correctAnswer: 'A' });
  });

  it('8b. Dictation: hide/show follow the same rules and practice history keeps the original sentence', async () => {
    vi.stubEnv('SERVICE_ROLE', 'content');
    const topic = randomUUID(), lesson = randomUUID(), segment = randomUUID();
    await content.query(`INSERT INTO public.dictationtopics(id,title,slug) VALUES($1,'Topic',$2)`, [topic, `t-${topic}`]);
    await content.query(
      `INSERT INTO public.dictationlessons(id,title,slug,status,sentence_count,full_audio_url,total_duration_ms,topic_id,level) VALUES($1,'Lesson',$2,'READY',1,'/media/full.wav',1000,$3,'"B1"')`,
      [lesson, `l-${lesson}`, topic],
    );
    await content.query(
      `INSERT INTO public.dictationsegments(id,lesson_id,"order",text,source,language,start_ms,end_ms,duration_ms) VALUES($1,$2,0,'Original sentence.','TTS','en-US',0,1000,1000)`,
      [segment, lesson],
    );
    expect((await lessons.publish('dictation', lesson, actor)).visibility).toBe('VISIBLE');
    const status = async () => (await content.query('SELECT status,publication_status FROM public.dictationlessons WHERE id=$1', [lesson])).rows[0];
    expect(await status()).toEqual({ status: 'PUBLISHED', publication_status: 'PUBLISHED' });
    const session = (await content.query(
      `INSERT INTO public.dictation_learning_sessions(user_id,lesson_id,lesson_revision,sentence_count) SELECT $1,id,publication_revision,1 FROM public.dictationlessons WHERE id=$2 RETURNING id,lesson_revision`,
      [learner, lesson],
    )).rows[0];
    await content.query(
      `INSERT INTO public.dictation_learning_events(id,session_id,action,segment_index,submitted_text,reference_text,is_correct,request_hash,result) VALUES($1,$2,'ATTEMPT',0,'original sentence','Original sentence.',true,'h','{}')`,
      [randomUUID(), session.id],
    );
    // Admin edits the transcript: hidden at once, history untouched.
    await content.query(`UPDATE public.dictationsegments SET text='Edited sentence.' WHERE id=$1`, [segment]);
    expect(await status()).toEqual({ status: 'READY', publication_status: 'DRAFT' });
    expect((await lessons.info('dictation', lesson)).visibility).toBe('HIDDEN');
    const event = (await content.query('SELECT reference_text FROM public.dictation_learning_events WHERE session_id=$1', [session.id])).rows[0];
    expect(event.reference_text).toBe('Original sentence.');
    // Audio still processing → cannot be shown.
    await content.query(`UPDATE public.dictationlessons SET status='PROCESSING_AUDIO' WHERE id=$1`, [lesson]);
    const refused: any = await lessons.publish('dictation', lesson, actor).catch((e) => e);
    expect(refused.status).toBe(409);
    expect(refused.getResponse().issues.map((i: any) => i.code)).toContain('AUDIO_NOT_READY');
    await content.query(`UPDATE public.dictationlessons SET status='READY' WHERE id=$1`, [lesson]);
    expect((await lessons.publish('dictation', lesson, actor)).visibility).toBe('VISIBLE');
    expect((await lessons.unpublish('dictation', lesson, actor)).visibility).toBe('HIDDEN');
    expect(await status()).toEqual({ status: 'READY', publication_status: 'IN_REVIEW' });
    const revision = (await content.query('SELECT publication_revision FROM public.dictationlessons WHERE id=$1', [lesson])).rows[0].publication_revision;
    expect(revision).toBeGreaterThan(session.lesson_revision);
  });
});
