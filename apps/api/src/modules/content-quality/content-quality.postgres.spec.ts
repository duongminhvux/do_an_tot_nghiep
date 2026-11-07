import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { createConnection } from '../../postgres/connection.js';
import { PublicationService } from '../publication/publication.service.js';
import { ContentQualityService, MEDIA_PROBE_CONCURRENCY, MEDIA_URLS_PER_TICK } from './content-quality.service.js';
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
    external = randomUUID(),
    exam = randomUUID();
  const scan = () => new ContentQualityService(db, source, media);
  const service = scan();
  let reachable = false,
    transient = false,
    slow = 0,
    active = 0,
    peak = 0;
  const probe = vi.spyOn(media, 'probe').mockImplementation(async (url) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1 + slow));
    active--;
    if (url === '/media/f11-missing.wav' && transient) return 'UNVERIFIED';
    return url === '/media/f11-missing.wav' && !reachable ? 'MISSING' : 'OK';
  });
  let gate: Promise<void> | null = null,
    entered: (() => void) | null = null;
  const fetchImpl = async (url: string) => {
    if (slow) await new Promise((resolve) => setTimeout(resolve, slow));
    if (gate) {
      entered?.();
      await gate;
    }
    const parsed = new URL(url);
    const role = process.env.SERVICE_ROLE;
    try {
      vi.stubEnv('SERVICE_ROLE', 'assessment');
      const single = parsed.pathname.match(/\/exams\/([0-9a-f-]{36})$/);
      if (single)
        return new Response(JSON.stringify({ data: await examSource.one('exams', single[1]) }));
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
  };
  const sourceFetch = vi.fn(fetchImpl);
  const finish = async (instance = service) => {
    for (let i = 0; i < 150; i++) {
      const current = (await instance.list()).job;
      if (current?.state === 'COMPLETED' || current?.state === 'FAILED')
        return current;
      const before = probe.mock.calls.length;
      await instance.processBatch();
      expect(probe.mock.calls.length - before).toBeLessThanOrEqual(MEDIA_URLS_PER_TICK);
    }
    throw new Error('Scan did not terminate');
  };
  beforeAll(async () => {
    vi.stubEnv('SERVICE_ROLE', 'content');
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'f11-source-token-'.repeat(3));
    vi.stubGlobal('fetch', sourceFetch);
    await content.query(
      `INSERT INTO public.words(id,word,slug,level,parts,audio) VALUES($1,$2,$2,'B1','[{"partOfSpeech":"noun","meanings":[{"definition":"x"}]}]',$3)`,
      [external, `f11-external-${external}`, JSON.stringify({ us: 'https://cdn.example.org/audio/f11.mp3' })],
    );
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
    expect(peak).toBeLessThanOrEqual(MEDIA_PROBE_CONCURRENCY);
    const report = await service.list({ category: 'MEDIA' });
    expect(report.groups.MEDIA_BROKEN.resources).toBeGreaterThan(0);
    expect(report.groups.DUPLICATE.resources).toBeGreaterThan(0);
    // Other spec files may share the disposable DB; this spec created 14 items.
    expect(report.stats.scanned).toBeGreaterThanOrEqual(14);
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
  it('records external media without fetching it and creates no finding for it', async () => {
    const snapshot = (await service.list()).job!;
    const link = await content.query(
      `SELECT outcome FROM public.content_quality_media_links WHERE job_id=$1 AND resource_id=$2`,
      [snapshot.id, external],
    );
    expect(link.rows).toEqual([{ outcome: 'EXTERNAL' }]);
    expect(probe.mock.calls.some(([url]) => url.startsWith('https://cdn.example.org'))).toBe(false);
    const report = await service.list({ q: external });
    expect(report.items.flatMap((item: any) => item.findings).filter((f: any) => f.code.startsWith('MEDIA_'))).toEqual([]);
    expect(report.stats.externalMedia).toBeGreaterThanOrEqual(1);
  });
  it('KPIs count content, findings and media separately and match the filtered list', async () => {
    const report = await service.list();
    const errors = await service.list({ severity: 'error' });
    const warnings = await service.list({ severity: 'warning' });
    expect(report.stats.resourcesWithErrors).toBe(errors.total);
    expect(report.stats.resourcesWithWarnings).toBe(warnings.total);
    expect(report.stats.resourcesWithIssues).toBe(report.total);
    const errorItems: any[] = [];
    for (let page = 1; page <= Math.ceil(errors.total / errors.pageSize); page++)
      errorItems.push(...(await service.list({ severity: 'error', page })).items);
    expect(errorItems.reduce((sum, item) => sum + item.errors, 0)).toBe(report.stats.errorFindings);
    expect(report.stats.brokenMedia).toBe(
      errorItems.flatMap((item) => item.findings).filter((f: any) => f.code === 'MEDIA_MISSING').length,
    );
    const grouped = (await service.list({ q: exam })).items;
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ kind: 'exams', resourceId: exam, editPath: `/assessment/${exam}` });
    expect(grouped[0].findings.every((f: any) => typeof f.message === 'string' && typeof f.path === 'string')).toBe(true);
  });
  it('rechecks one item without a scan; a transient media failure keeps the missing-media error; history is kept', async () => {
    const jobs = (await content.query('SELECT count(*)::int AS n FROM public.content_quality_jobs')).rows[0].n;
    reachable = false;
    const missing = await service.recheck('words', twin, actor);
    expect(missing.errors).toBeGreaterThanOrEqual(1);
    let item = (await service.list({ q: twin })).items[0];
    expect(item.rechecked).toBe(true);
    expect(item.findings.map((f: any) => f.code)).toContain('MEDIA_MISSING');
    transient = true;
    const kept = await service.recheck('words', twin, actor);
    expect(kept.resolved).toBe(0);
    item = (await service.list({ q: twin })).items[0];
    expect(item.findings.find((f: any) => f.code === 'MEDIA_MISSING')?.severity).toBe('error');
    transient = false;
    reachable = true;
    const fixed = await service.recheck('words', twin, actor);
    expect(fixed.resolved).toBeGreaterThanOrEqual(1);
    item = (await service.list({ q: twin })).items[0];
    expect(item?.findings.map((f: any) => f.code) ?? []).not.toContain('MEDIA_MISSING');
    const history = await content.query(
      'SELECT resolved_count FROM public.content_quality_rechecks WHERE resource_id=$1 ORDER BY id',
      [twin],
    );
    expect(history.rows.map((r) => r.resolved_count)).toEqual([expect.any(Number), 0, fixed.resolved]);
    expect((await content.query('SELECT count(*)::int AS n FROM public.content_quality_jobs')).rows[0].n).toBe(jobs);
  });
  it('rechecks an exam through the owner service and refuses a parallel recheck of the same item', async () => {
    sourceFetch.mockImplementation(fetchImpl);
    // Hold the first recheck inside its locked transaction, then start the second.
    let release!: () => void;
    gate = new Promise<void>((resolve) => (release = resolve));
    const reached = new Promise<void>((resolve) => (entered = resolve));
    const first = service.recheck('exams', exam, actor);
    await reached;
    gate = null;
    const second = await service.recheck('exams', exam, actor).then(() => 200, (error) => error.status);
    release();
    const statuses = [await first.then(() => 200), second];
    expect(statuses.sort()).toEqual([200, 409]);
    const item = (await service.list({ q: exam })).items[0];
    expect(item.rechecked).toBe(true);
    expect(item.findings.map((f: any) => f.code)).toContain('EMPTY');
  });
  it('stores nothing when the source is unavailable during a recheck', async () => {
    const before = (await content.query('SELECT count(*)::int AS n FROM public.content_quality_rechecks')).rows[0].n;
    sourceFetch.mockRejectedValueOnce(new Error('source down'));
    await expect(service.recheck('exams', exam, actor)).rejects.toBeTruthy();
    expect((await content.query('SELECT count(*)::int AS n FROM public.content_quality_rechecks')).rows[0].n).toBe(before);
  });
  it('flags edited content as stale and drops deleted content from the report', async () => {
    await content.query(`UPDATE public.words SET word=word||'x',updated_at=now() WHERE id=$1`, [word]);
    const edited = (await service.list({ q: word })).items[0];
    expect(edited?.stale).toBe(true);
    await content.query('UPDATE public.words SET is_deleted=true WHERE id=$1', [word]);
    expect((await service.list({ q: word })).items).toEqual([]);
    const result = await service.recheck('words', word, actor);
    expect(result).toMatchObject({ errors: 0, warnings: 0 });
    const stored = await content.query('SELECT deleted FROM public.content_quality_rechecks WHERE resource_id=$1 ORDER BY id DESC LIMIT 1', [word]);
    expect(stored.rows[0].deleted).toBe(true);
  });
});
