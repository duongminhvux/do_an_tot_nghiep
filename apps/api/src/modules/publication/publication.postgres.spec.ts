import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import {createConnection} from '../../postgres/connection.js';
import {SqlRecords} from '../../postgres/records.js';
import {sql,rows} from '../../postgres/sql.js';
import {randomUUID} from 'node:crypto';
import { PublicationService } from './publication.service.js';
import { publicationScope } from './publication-scope.js';
import { Exam } from '../assessment/exams/rows/exam.row.js';
import { Attempt } from '../assessment/attempts/rows/attempt.row.js';
import { Question } from '../assessment/questions/rows/question.row.js';
import { Passage } from '../assessment/questions/rows/passage.row.js';
import { AttemptsService } from '../assessment/attempts/attempts.service.js';
import { DomainOutboxService } from '../../common/events/domain-outbox.service.js';
import { ExamMode } from '../assessment/attempts/attempt.types.js';
import { Word } from '../vocabulary/words/word.row.js';
import { Lesson } from '../vocabulary/lessons/lesson.row.js';
import { MistakeSourceController } from '../../internal/mistake-source.controller.js';

describe.runIf(
  Boolean(
    process.env.F01_ASSESSMENT_TEST_DATABASE_URL &&
    process.env.F01_CONTENT_TEST_DATABASE_URL,
  ),
)('F10 PostgreSQL workflow', () => {
  const assessment = new Pool({
    connectionString: process.env.F01_ASSESSMENT_TEST_DATABASE_URL,
  });
  const content = new Pool({
    connectionString: process.env.F01_CONTENT_TEST_DATABASE_URL,
  });
  const exams = new PublicationService(createConnection(assessment)),
    contents = new PublicationService(createConnection(content));
  const actor = randomUUID(),
    user = randomUUID(),
    exam = randomUUID(),
    question = randomUUID(),
    collection = randomUUID(),
    lesson = randomUUID(),
    word = randomUUID(),
    dictation = randomUUID(),
    segment = randomUUID();
  let attempts: AttemptsService, attemptId: string;
  beforeAll(async () => {
    await assessment.query(
      `INSERT INTO public.exams(id,name,slug,type,is_active) VALUES($1,$2,$2,'TOEIC',true)`,
      [exam, `f10-${exam}`],
    );
    await content.query(
      `INSERT INTO public.collections(id,name,slug,is_active) VALUES($1,$2,$2,true)`,
      [collection, `f10-${collection}`],
    );
    await content.query(
      `INSERT INTO public.lessons(id,collection_id,title,slug,is_active) VALUES($1,$2,'F10 Lesson',$3,true)`,
      [lesson, collection, `f10-${lesson}`],
    );
    await content.query(
      `INSERT INTO public.words(id,word,slug,level,parts,is_active) VALUES($1,'publishword',$2,'B1','[{"partOfSpeech":"noun","meanings":[{"definition":"A valid meaning"}]}]',true)`,
      [word, `f10-${word}`],
    );
    await content.query(
      `INSERT INTO public.lessonwords(lesson_id,word_id) VALUES($1,$2)`,
      [lesson, word],
    );
    await content.query(
      `INSERT INTO public.dictationlessons(id,title,slug,status,sentence_count,full_audio_url,total_duration_ms) VALUES($1,'F10 Dictation',$2,'READY',1,'/media/full.wav',1000)`,
      [dictation, `f10-${dictation}`],
    );
    await content.query(
      `INSERT INTO public.dictationsegments(id,lesson_id,"order",text,source,language,start_ms,end_ms,duration_ms) VALUES($1,$2,0,'A sentence.','TTS','en-US',0,2000,2000)`,
      [segment, dictation],
    );
    attempts = new AttemptsService(createConnection(assessment),undefined,new DomainOutboxService(createConnection(assessment)));
  });
  afterAll(async () => {
    await Promise.all([assessment.end(), content.end()]);
    vi.unstubAllEnvs();
  });
  it('new content is draft, cannot start an attempt, and invalid content cannot publish', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    expect((await exams.info('exams', exam)).publicationStatus).toBe('DRAFT');
    expect(
      await publicationScope.run(true, () =>
        new SqlRecords<any>(createConnection(assessment),'exams').one(sql`id=${exam}::uuid AND publication_status='PUBLISHED'`),
      ),
    ).toBeNull();
    await expect(
      attempts.create(user, {
        examId: exam,
        mode: ExamMode.PRACTICE,
        selectedParts: [5],
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(exams.publish('exams', exam, actor)).rejects.toMatchObject({
      status: 409,
    });
    const checked = await exams.validate('exams', exam, actor, 'en');
    expect(
      checked.publicationValidation.issues.some(
        (issue: any) => issue.code === 'EMPTY',
      ),
    ).toBe(true);
    await expect(exams.publish('exams', exam, actor)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('publishes valid content, stamps the real actor, and preserves snapshots after content is edited', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    await assessment.query(
      `INSERT INTO public.questions(id,exam_id,section,part,content,options,correct_answer,is_active) VALUES($1,$2,'READING',5,'Original question','[{"key":"A","text":"one"},{"key":"B","text":"two"},{"key":"C","text":"three"},{"key":"D","text":"four"}]','A',true)`,
      [question, exam],
    );
    const checked = await exams.validate('exams', exam, actor, 'en');
    expect(checked.publicationValidation.issues).toEqual([]);
    const published = await exams.publish('exams', exam, actor, 'en');
    expect(published).toMatchObject({
      publicationStatus: 'PUBLISHED',
      publishedBy: actor,
    });
    expect(published.audit[0]).toMatchObject({
      action: 'PUBLISH',
      actorId: actor,
    });
    const attempt = await attempts.create(user, {
      examId: exam,
      mode: ExamMode.PRACTICE,
      selectedParts: [5],
    });
    attemptId = String(attempt._id);
    await assessment.query(
      'UPDATE public.questions SET content=$2 WHERE id=$1',
      [question, 'Edited draft question'],
    );
    expect((await exams.info('exams', exam)).publicationStatus).toBe('DRAFT');
    await expect(exams.publish('exams', exam, actor)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      attempts.create(user, {
        examId: exam,
        mode: ExamMode.PRACTICE,
        selectedParts: [5],
      }),
    ).rejects.toMatchObject({ status: 404 });
    const existing = await publicationScope.run(true, () =>
      attempts.findOne(user, attemptId),
    );
    expect(existing.questions[0].content).toBe('Original question');
  });
  it('does not let isActive or a stale JSON payload bypass publication', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    await assessment.query(
      `UPDATE public.exams SET is_active=true,payload=jsonb_set(payload,'{publicationStatus}','"PUBLISHED"'),publication_status='PUBLISHED' WHERE id=$1`,
      [exam],
    );
    expect((await exams.info('exams', exam)).publicationStatus).toBe('DRAFT');
    expect(
      await publicationScope.run(true, () =>
        new SqlRecords<any>(createConnection(assessment),'exams').one(sql`id=${exam}::uuid AND publication_status='PUBLISHED'`),
      ),
    ).toBeNull();
    const doc=await new SqlRecords(createConnection(assessment),'exams').one(sql`id=${exam}::uuid`);
    expect(doc.publicationStatus).toBe('DRAFT');
  });
  it('preview uses the existing unfinished-TOEIC projection and has no scoring side effects', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    await assessment.query(
      `INSERT INTO public.questions(exam_id,section,part,content,options,correct_answer,explanation,audio_url,is_active) VALUES($1,'LISTENING',2,'SECRET_SCRIPT','[{"key":"A","text":"SECRET_OPTION"},{"key":"B","text":"two"},{"key":"C","text":"three"}]','A','SECRET_EXPLANATION','/media/audio.mp3',true)`,
      [exam],
    );
    const before = (
      await assessment.query(
        'SELECT COUNT(*)::int AS count FROM public.attempts WHERE user_id=$1',
        [user],
      )
    ).rows[0].count;
    const preview = await exams.preview('exams', exam);
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain('correctAnswer');
    expect(serialized).not.toContain('SECRET_SCRIPT');
    expect(serialized).not.toContain('SECRET_OPTION');
    expect(serialized).not.toContain('SECRET_EXPLANATION');
    expect(
      (
        await assessment.query(
          'SELECT COUNT(*)::int AS count FROM public.attempts WHERE user_id=$1',
          [user],
        )
      ).rows[0].count,
    ).toBe(before);
  });
  it('requires published words for lessons and invalidates both when a word is edited', async () => {
    vi.stubEnv('SERVICE_ROLE', 'content');
    expect(
      (
        await contents.validate('lessons', lesson, actor, 'en')
      ).publicationValidation.issues.some(
        (i: any) => i.code === 'WORD_UNPUBLISHED',
      ),
    ).toBe(true);
    expect(
      (await contents.validate('words', word, actor, 'en'))
        .publicationValidation.issues,
    ).toEqual([]);
    await contents.publish('words', word, actor, 'en');
    expect(
      (await contents.validate('lessons', lesson, actor, 'en'))
        .publicationValidation.issues,
    ).toEqual([]);
    await contents.publish('lessons', lesson, actor, 'en');
    expect(
      await publicationScope.run(true, () =>
        new SqlRecords<any>(createConnection(content),'lessons').one(sql`id=${lesson}::uuid AND publication_status='PUBLISHED'`),
      ),
    ).not.toBeNull();
    await content.query(`UPDATE public.words SET parts='[]' WHERE id=$1`, [
      word,
    ]);
    expect((await contents.info('words', word)).publicationStatus).toBe(
      'DRAFT',
    );
    expect((await contents.info('lessons', lesson)).publicationStatus).toBe(
      'DRAFT',
    );
    expect(
      await publicationScope.run(true, () =>
        new SqlRecords<any>(createConnection(content),'words').one(sql`id=${word}::uuid AND publication_status='PUBLISHED'`),
      ),
    ).toBeNull();
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'f10-internal-token-'.repeat(2));
    expect(
      await new MistakeSourceController(createConnection(content)).titles(
        process.env.INTERNAL_SERVICE_TOKEN!,
        { wordIds: [word] },
      ),
    ).toEqual({});
    await expect(
      contents.publish('words', word, actor, 'en'),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('checks Dictation timing before publication and keeps processing status separate from review state', async () => {
    vi.stubEnv('SERVICE_ROLE', 'content');
    const invalid = await contents.validate(
      'dictation',
      dictation,
      actor,
      'en',
    );
    expect(invalid.publicationStatus).toBe('IN_REVIEW');
    expect(
      invalid.publicationValidation.issues.some(
        (i: any) => i.code === 'SEGMENT_TIMING',
      ),
    ).toBe(true);
    await expect(
      contents.publish('dictation', dictation, actor, 'en'),
    ).rejects.toMatchObject({ status: 409 });
    await content.query(
      'UPDATE public.dictationsegments SET end_ms=1000,duration_ms=1000 WHERE id=$1',
      [segment],
    );
    expect(
      (await contents.info('dictation', dictation)).publicationStatus,
    ).toBe('DRAFT');
    expect(
      (await contents.validate('dictation', dictation, actor, 'en'))
        .publicationValidation.issues,
    ).toEqual([]);
    await contents.publish('dictation', dictation, actor, 'en');
    expect(
      (
        await content.query(
          'SELECT status,publication_status,published_by FROM public.dictationlessons WHERE id=$1',
          [dictation],
        )
      ).rows[0],
    ).toMatchObject({
      status: 'PUBLISHED',
      publication_status: 'PUBLISHED',
      published_by: actor,
    });
    await contents.unpublish('dictation', dictation, actor);
    expect(
      (
        await content.query(
          'SELECT status,publication_status FROM public.dictationlessons WHERE id=$1',
          [dictation],
        )
      ).rows[0],
    ).toEqual({ status: 'READY', publication_status: 'DRAFT' });
  });
  it('rejects a new TOEIC snapshot if content changes between its read and insertion',async()=>{
    vi.stubEnv('SERVICE_ROLE','assessment');
    await exams.validate('exams',exam,actor,'en');await exams.publish('exams',exam,actor,'en');
    const original=SqlRecords.prototype.insert;
    const spy=vi.spyOn(SqlRecords.prototype,'insert').mockImplementation(async function(this:SqlRecords,value:any,columns:any){
      if(this.table==='attempts')await assessment.query('UPDATE public.questions SET content=$2 WHERE id=$1',[question,'A racing edit']);
      return original.call(this,value,columns);
    });
    const service=new AttemptsService(createConnection(assessment));
    const before=(await assessment.query('SELECT COUNT(*)::int AS count FROM public.attempts WHERE user_id=$1',[user])).rows[0].count;
    try { await expect(service.create(user,{examId:exam,mode:ExamMode.PRACTICE,selectedParts:[5]})).rejects.toMatchObject({status:409}); }
    finally {spy.mockRestore();}
    expect((await assessment.query('SELECT COUNT(*)::int AS count FROM public.attempts WHERE user_id=$1',[user])).rows[0].count).toBe(before);
  });
});
