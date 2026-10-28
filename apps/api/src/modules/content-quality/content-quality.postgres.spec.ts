import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { createConnection } from '../../postgres/connection.js';
import { PublicationService } from '../publication/publication.service.js';
import { ContentQualityService } from './content-quality.service.js';
import { QualitySourceService } from './quality-source.service.js';
import { QualityMediaService } from './quality-media.service.js';

describe.runIf(
  Boolean(
    process.env.F01_CONTENT_TEST_DATABASE_URL &&
    process.env.F01_ASSESSMENT_TEST_DATABASE_URL,
  ),
)('F11 PostgreSQL resumable quality scan', () => {
  const content = new Pool({
    connectionString: process.env.F01_CONTENT_TEST_DATABASE_URL,
  });
  const assessment = new Pool({
    connectionString: process.env.F01_ASSESSMENT_TEST_DATABASE_URL,
  });
  const db = createConnection(content),
    source = new QualitySourceService(db, new PublicationService(db));
  const examDb = createConnection(assessment),
    examSource = new QualitySourceService(
      examDb,
      new PublicationService(examDb),
    );
  const media = new QualityMediaService();
  const actor = randomUUID(),
    word = randomUUID(),
    twin = randomUUID(),
    exam = randomUUID();
  const scan = () => new ContentQualityService(db, source, media);
  const service = scan();
  let reachable = false,
    active = 0,
    peak = 0;
  const probe = vi.spyOn(media, 'probe').mockImplementation(async (url) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return url === '/media/f11-missing.wav' && !reachable ? 'MISSING' : 'OK';
  });
  const sourceFetch = vi.fn(async (url: string) => {
    const parsed = new URL(url);
    const role = process.env.SERVICE_ROLE;
    try {
      vi.stubEnv('SERVICE_ROLE', 'assessment');
      return new Response(
        JSON.stringify({
          data: await examSource.batch(
            'exams',
            parsed.searchParams.get('cursor'),
            parsed.searchParams.get('before')!,
          ),
        }),
      );
    } finally {
      vi.stubEnv('SERVICE_ROLE', role!);
    }
  });
  const finish = async (instance = service) => {
    for (let i = 0; i < 150; i++) {
      const current = (await instance.list()).job;
      if (current?.state === 'COMPLETED' || current?.state === 'FAILED')
        return current;
      const before = probe.mock.calls.length;
      await instance.processBatch();
      expect(probe.mock.calls.length - before).toBeLessThanOrEqual(4);
    }
    throw new Error('Scan did not terminate');
  };
  beforeAll(async () => {
    vi.stubEnv('SERVICE_ROLE', 'content');
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'f11-source-token-'.repeat(3));
    vi.stubGlobal('fetch', sourceFetch);
    for (const id of [
      word,
      twin,
      ...Array.from({ length: 10 }, () => randomUUID()),
    ]) {
      await content.query(
        `INSERT INTO public.words(id,word,slug,level,parts,audio) VALUES($1,$2,$3,'B1','[]',$4)`,
        [
          id,
          id === word
            ? 'f11duplicate'
            : id === twin
              ? 'F11DUPLICATE'
              : `f11-${id}`,
          `f11-${id}`,
          JSON.stringify(
            id === word
              ? {}
              : {
                  us:
                    id === twin
                      ? '/media/f11-missing.wav'
                      : `/media/f11-${id}.wav`,
                },
          ),
        ],
      );
    }
    await assessment.query(
      `INSERT INTO public.exams(id,name,slug,type) VALUES($1,'F11 incomplete',$2,'TOEIC')`,
      [exam, `f11-${exam}`],
    );
  });
  afterAll(async () => {
    await Promise.all([content.end(), assessment.end()]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it('opening the report is read-only and concurrent enqueue coalesces into one durable job', async () => {
    const initial = await service.list();
    expect(initial.snapshotAt).toBeNull();
    expect(initial.job).toBeNull();
    expect(sourceFetch).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
    const jobs = await Promise.all(
      Array.from({ length: 6 }, () => service.enqueue(actor)),
    );
    expect(new Set(jobs.map((job) => job.id)).size).toBe(1);
    expect(jobs[0].actor_id).toBe(actor);
  });
  it('persists a bounded batch and resumes through a new worker instance; concurrent workers do not double-count', async () => {
    await Promise.all([service.processBatch(), scan().processBatch()]);
    const job = (await service.list()).job!;
    expect(job.scanned_count).toBe(10);
    expect((await service.list()).snapshotAt).toBeNull();
    const completed = await finish(scan());
    expect(completed!.state).toBe('COMPLETED');
    expect(peak).toBeLessThanOrEqual(4);
    const report = await service.list('MEDIA');
    expect(report.stats.missingAudio).toBeGreaterThan(0);
    expect(report.stats.duplicates).toBeGreaterThan(0);
    const findings = await content.query(
      `SELECT code,edit_path FROM public.content_quality_findings WHERE job_id=$1 AND resource_id=$2`,
      [completed!.id, word],
    );
    expect(
      findings.rows.some(
        (i) =>
          i.code === 'AUDIO_REQUIRED' &&
          i.edit_path === `/vocabulary/words?editWordId=${word}`,
      ),
    ).toBe(true);
    expect(
      (
        await content.query(
          `SELECT count(*)::int AS count FROM public.content_quality_findings WHERE job_id=$1 AND resource_id=$2`,
          [completed!.id, exam],
        )
      ).rows[0].count,
    ).toBeGreaterThan(0);
    expect(
      (
        await content.query(
          'SELECT publication_status FROM public.words WHERE id=$1',
          [word],
        )
      ).rows[0].publication_status,
    ).toBe('DRAFT');
  });
  it('fixing audio and rescanning clears missing-audio/dead-link findings, including the same repaired URL', async () => {
    const oldSnapshot = (await service.list()).snapshotAt;
    await content.query(
      `UPDATE public.words SET audio='{"us":"/media/f11-fixed.wav"}' WHERE id=$1`,
      [word],
    );
    reachable = true;
    await service.enqueue(actor);
    expect((await service.list()).snapshotAt).toEqual(oldSnapshot);
    const complete = await finish();
    expect(complete!.state).toBe('COMPLETED');
    const issues = await content.query(
      `SELECT code FROM public.content_quality_findings WHERE job_id=$1 AND resource_id=ANY($2::uuid[]) AND code IN ('AUDIO_REQUIRED','MEDIA_MISSING')`,
      [complete!.id, [word, twin]],
    );
    expect(issues.rows).toEqual([]);
    expect(
      probe.mock.calls.filter(([url]) => url === '/media/f11-missing.wav'),
    ).toHaveLength(2);
    expect(
      probe.mock.calls.filter(
        ([url]) =>
          url.startsWith('/media/f11-') &&
          url !== '/media/f11-missing.wav' &&
          url !== '/media/f11-fixed.wav',
      ),
    ).toHaveLength(10);
  });
  it('failed source retries three times without exposing partial findings or dropping the last completed snapshot', async () => {
    const previous = await service.list();
    await service.enqueue(actor);
    sourceFetch.mockRejectedValue(new Error('source down'));
    const failed = await finish();
    expect(failed!.state).toBe('FAILED');
    expect(failed!.failures).toBe(3);
    expect((await service.list()).snapshotAt).toEqual(previous.snapshotAt);
    expect((await service.list()).stats).toEqual(previous.stats);
  });
});
