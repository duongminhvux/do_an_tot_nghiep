import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PublicationKind } from '@repo/shared-types/publication';
import {
  InjectPgConnection,
  type PgConnection,
} from '../../postgres/connection.js';
import { serviceRole, serviceUrl } from '../../postgres/ownership.js';
import { QualitySourceService } from './quality-source.service.js';
import {
  QualityMediaService,
  qualityMediaTarget,
  type MediaOutcome,
} from './quality-media.service.js';
import {
  QUALITY_GROUP_CODES,
  QUALITY_KINDS,
  type QualityCategory,
  type QualityGroup,
  type QualityItem,
} from './quality-rules.js';

/** Media URLs probed per worker tick and how many HEAD requests run at once. */
export const MEDIA_URLS_PER_TICK = 12;
export const MEDIA_PROBE_CONCURRENCY = 6;
/** Upper bound for a single-content recheck (an exam has ≤ ~400 media refs). */
const RECHECK_MEDIA_LIMIT = 400;
const PAGE_SIZE = 20;

/**
 * Learning programmes (vocabulary collections, Dictation topics) that are
 * switched on but have no lessons, or no published lesson yet. Always live.
 */
const PROGRAM_CHECKS = `
  SELECT 'collections' AS kind,c.id,c.name AS title,c.updated_at,
    '/vocabulary/collections?collectionId='||c.id AS edit_path,
    CASE WHEN COUNT(l.id)=0 THEN 'PROGRAM_EMPTY' ELSE 'PROGRAM_UNPUBLISHED' END AS code,
    CASE WHEN COUNT(l.id)=0 THEN 'error' ELSE 'warning' END AS severity,
    CASE WHEN COUNT(l.id)=0 THEN 'Chương trình học chưa có bài học nào.'
      ELSE 'Chương trình học có '||COUNT(l.id)||' bài nhưng chưa bài nào được hiển thị.' END AS message_vi,
    CASE WHEN COUNT(l.id)=0 THEN 'The programme has no lessons.'
      ELSE 'The programme has '||COUNT(l.id)||' lessons but none is visible.' END AS message_en
  FROM public.collections c
  LEFT JOIN public.lessons l ON l.collection_id=c.id AND l.is_active IS NOT FALSE AND l.is_deleted IS NOT TRUE
  WHERE c.is_active IS NOT FALSE AND c.is_deleted IS NOT TRUE
  GROUP BY c.id
  HAVING COUNT(l.id) FILTER(WHERE l.publication_status='PUBLISHED')=0
  UNION ALL
  SELECT 'dictationTopics',t.id,t.title,t.updated_at,'/dictation/structure',
    CASE WHEN COUNT(d.id)=0 THEN 'PROGRAM_EMPTY' ELSE 'PROGRAM_UNPUBLISHED' END,
    CASE WHEN COUNT(d.id)=0 THEN 'error' ELSE 'warning' END,
    CASE WHEN COUNT(d.id)=0 THEN 'Chủ đề Dictation chưa có bài nào.'
      ELSE 'Chủ đề Dictation có '||COUNT(d.id)||' bài nhưng chưa bài nào được hiển thị.' END,
    CASE WHEN COUNT(d.id)=0 THEN 'The Dictation topic has no lessons.'
      ELSE 'The Dictation topic has '||COUNT(d.id)||' lessons but none is visible.' END
  FROM public.dictationtopics t
  LEFT JOIN public.dictationlessons d ON d.topic_id=t.id AND d.is_deleted IS NOT TRUE
  WHERE t.is_active IS NOT FALSE AND t.is_deleted IS NOT TRUE
  GROUP BY t.id
  HAVING COUNT(d.id) FILTER(WHERE d.publication_status='PUBLISHED')=0`;

/** Code → report group, as SQL (codes are constants, not user input). */
const GROUP_SQL = `CASE ${Object.entries(QUALITY_GROUP_CODES)
  .filter(([, codes]) => codes.length)
  .map(
    ([group, codes]) =>
      `WHEN code IN (${codes.map((code) => `'${code}'`).join(',')}) THEN '${group}'`,
  )
  .join(' ')} ELSE 'REQUIRED' END`;

export type QualityArea = 'toeic' | 'dictation' | 'vocabulary';
const AREA_KINDS: Record<QualityArea, string[]> = {
  toeic: ['exams'],
  dictation: ['dictation', 'dictationTopics'],
  vocabulary: ['words', 'lessons', 'collections'],
};
export interface QualityListQuery {
  area?: QualityArea;
  severity?: 'error' | 'warning';
  group?: QualityGroup;
  /** Legacy filter kept for API compatibility. */
  category?: QualityCategory;
  q?: string;
  sort?: 'severity' | 'recent';
  page?: number;
  lang?: string;
}
type StoredFinding = {
  category: string;
  code: string;
  path: string;
  severity: 'error' | 'warning';
  message_vi: string;
  message_en: string;
};

/** Run `work` over `items` with at most `limit` in flight. */
async function pooled<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>) {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
}

@Injectable()
export class ContentQualityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContentQualityService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  constructor(
    @InjectPgConnection() private readonly db: PgConnection,
    private readonly source: QualitySourceService,
    private readonly media: QualityMediaService,
  ) {}
  onModuleInit() {
    if (
      serviceRole() !== 'content' ||
      process.env.QUALITY_WORKER_DISABLED === '1'
    )
      return;
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.processBatch()
          .catch((error) =>
            this.logger.error(
              'Quality worker batch failed',
              error instanceof Error ? error.message : '',
            ),
          )
          .finally(() => {
            this.running = undefined;
          });
    }, 2000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  private owner() {
    if (serviceRole() !== 'content') throw new ForbiddenException();
  }
  async enqueue(actorId: string) {
    this.owner();
    await this.db.query(
      `INSERT INTO public.content_quality_jobs(actor_id) VALUES($1) ON CONFLICT DO NOTHING`,
      [actorId],
    );
    return (
      (
        await this.db.query(
          `SELECT * FROM public.content_quality_jobs WHERE state IN ('PENDING','RUNNING') ORDER BY created_at DESC LIMIT 1`,
        )
      ).rows[0] ??
      (
        await this.db.query(
          `SELECT * FROM public.content_quality_jobs ORDER BY created_at DESC LIMIT 1`,
        )
      ).rows[0]
    );
  }

  private async snapshot() {
    return (
      (
        await this.db.query(
          `SELECT id,finished_at,scanned_count FROM public.content_quality_jobs WHERE state='COMPLETED' ORDER BY finished_at DESC,id DESC LIMIT 1`,
        )
      ).rows[0] ?? null
    );
  }

  /**
   * Current findings = latest completed scan, where a content item rechecked
   * after that scan is replaced by its newest recheck, plus live programme
   * checks. Content-owned items deleted since are dropped; items edited since
   * their check are flagged `stale`. Params: $1 job id, $2 job finished_at.
   */
  private currentSql(language: string) {
    const message = language === 'en' ? 'message_en' : 'message_vi';
    return `
      latest AS (
        SELECT DISTINCT ON (kind,resource_id) * FROM public.content_quality_rechecks
        WHERE $2::timestamptz IS NULL OR checked_at > $2::timestamptz
        ORDER BY kind,resource_id,checked_at DESC,id DESC
      ),
      raw AS (
        SELECT f.kind,f.resource_id,f.title,f.category,f.code,f.path,f.severity,f.${message} AS message,
          f.edit_path,f.content_updated_at,f.checked_at,false AS rechecked
        FROM public.content_quality_findings f
        WHERE f.job_id=$1::uuid AND NOT EXISTS (SELECT 1 FROM latest l WHERE l.kind=f.kind AND l.resource_id=f.resource_id)
        UNION ALL
        SELECT l.kind,l.resource_id,l.title,x.category,x.code,x.path,x.severity,x.${message},
          l.edit_path,l.content_updated_at,l.checked_at,true
        FROM latest l CROSS JOIN LATERAL jsonb_to_recordset(l.findings)
          AS x(category text,code text,path text,severity text,message_vi text,message_en text)
        WHERE NOT l.deleted
        UNION ALL
        SELECT kind,id,title,'DATA',code,'lessons',severity,${message},edit_path,updated_at,now(),false
        FROM (${PROGRAM_CHECKS}) programs
      ),
      current AS (
        SELECT r.*, ${GROUP_SQL} AS grp,
          COALESCE(CASE r.kind WHEN 'words' THEN w.updated_at WHEN 'lessons' THEN l.updated_at WHEN 'dictation' THEN d.updated_at END > r.checked_at, false) AS stale
        FROM raw r
        LEFT JOIN public.words w ON r.kind='words' AND w.id=r.resource_id
        LEFT JOIN public.lessons l ON r.kind='lessons' AND l.id=r.resource_id
        LEFT JOIN public.dictationlessons d ON r.kind='dictation' AND d.id=r.resource_id
        WHERE NOT (
          (r.kind='words' AND (w.id IS NULL OR w.is_deleted IS TRUE)) OR
          (r.kind='lessons' AND (l.id IS NULL OR l.is_deleted IS TRUE)) OR
          (r.kind='dictation' AND (d.id IS NULL OR d.is_deleted IS TRUE))
        )
      )`;
  }

  async list(query: QualityListQuery = {}) {
    this.owner();
    const language = query.lang === 'en' ? 'en' : 'vi';
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const latest =
      (
        await this.db.query(
          `SELECT * FROM public.content_quality_jobs ORDER BY created_at DESC,id DESC LIMIT 1`,
        )
      ).rows[0] ?? null;
    const snapshot = await this.snapshot();
    const base = [snapshot?.id ?? null, snapshot?.finished_at ?? null];
    const current = this.currentSql(language);
    const stats = (
      await this.db.query(
        `WITH ${current} SELECT
          COUNT(DISTINCT (kind,resource_id))::int AS "resourcesWithIssues",
          COUNT(DISTINCT (kind,resource_id)) FILTER(WHERE severity='error')::int AS "resourcesWithErrors",
          COUNT(DISTINCT (kind,resource_id)) FILTER(WHERE severity='warning')::int AS "resourcesWithWarnings",
          COUNT(*) FILTER(WHERE severity='error')::int AS "errorFindings",
          COUNT(*) FILTER(WHERE severity='warning')::int AS "warningFindings",
          COUNT(*) FILTER(WHERE code='MEDIA_MISSING')::int AS "brokenMedia",
          COUNT(*) FILTER(WHERE code='MEDIA_UNVERIFIED')::int AS "unverifiedMedia",
          COUNT(DISTINCT (kind,resource_id)) FILTER(WHERE stale)::int AS "staleResources"
        FROM current`,
        base,
      )
    ).rows[0];
    const groups = Object.fromEntries(
      (
        await this.db.query(
          `WITH ${current} SELECT grp,COUNT(DISTINCT (kind,resource_id))::int AS resources,COUNT(*)::int AS findings FROM current GROUP BY grp`,
          base,
        )
      ).rows.map((row) => [row.grp, { resources: row.resources, findings: row.findings }]),
    );
    const external = snapshot
      ? (
          await this.db.query(
            `SELECT COUNT(DISTINCT url)::int AS count FROM public.content_quality_media_links WHERE job_id=$1 AND outcome='EXTERNAL'`,
            [snapshot.id],
          )
        ).rows[0].count
      : 0;
    const filters = [
      query.area ? AREA_KINDS[query.area] ?? [] : null,
      query.severity ?? null,
      query.group ?? null,
      query.category ?? null,
      query.q?.trim() ? `%${query.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null,
    ];
    const filtered = `${current},
      filtered AS (
        SELECT * FROM current
        WHERE ($3::text[] IS NULL OR kind=ANY($3::text[]))
          AND ($4::text IS NULL OR severity=$4)
          AND ($5::text IS NULL OR grp=$5)
          AND ($6::text IS NULL OR category=$6)
          AND ($7::text IS NULL OR title ILIKE $7 OR resource_id::text=lower(btrim($7,'%')))
      )`;
    const params = [...base, ...filters];
    const total = (
      await this.db.query(
        `WITH ${filtered} SELECT COUNT(*)::int AS total FROM (SELECT 1 FROM filtered GROUP BY kind,resource_id) grouped`,
        params,
      )
    ).rows[0].total;
    const order =
      query.sort === 'recent'
        ? `"updatedAt" DESC NULLS LAST,"checkedAt" DESC,title`
        : `errors DESC,warnings DESC,"updatedAt" DESC NULLS LAST,title`;
    const items = (
      await this.db.query(
        `WITH ${filtered}
        SELECT kind,resource_id AS "resourceId",max(title) AS title,max(edit_path) AS "editPath",
          COUNT(*) FILTER(WHERE severity='error')::int AS errors,
          COUNT(*) FILTER(WHERE severity='warning')::int AS warnings,
          max(checked_at) AS "checkedAt",max(content_updated_at) AS "updatedAt",
          bool_or(stale) AS stale,bool_or(rechecked) AS rechecked,
          jsonb_agg(jsonb_build_object('code',code,'path',path,'severity',severity,'group',grp,'category',category,'message',message)
            ORDER BY CASE WHEN severity='error' THEN 0 ELSE 1 END,code,path) AS findings
        FROM filtered GROUP BY kind,resource_id
        ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET $8`,
        [...params, (page - 1) * PAGE_SIZE],
      )
    ).rows;
    return {
      items,
      total,
      page,
      pageSize: PAGE_SIZE,
      stats: {
        scanned: snapshot?.scanned_count ?? 0,
        ...stats,
        externalMedia: external,
      },
      groups,
      job: latest,
      snapshotAt: snapshot?.finished_at ?? null,
      stale:
        !snapshot ||
        Date.now() - new Date(snapshot.finished_at).getTime() > 86400000,
      feedbackAvailable: false,
    };
  }

  private async examSource(path: string) {
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!token || token.length < 24)
      throw new ServiceUnavailableException('Quality source unavailable');
    const response = await fetch(
      `${serviceUrl('assessment')}/api/_internal/content-quality/${path}`,
      {
        headers: { 'x-internal-token': token },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new ServiceUnavailableException('Quality source unavailable');
    const body = await response.json();
    return body && typeof body === 'object' && 'data' in body ? body.data : body;
  }
  private examBatch(
    cursor: string | null,
    before: string,
  ): Promise<{ items: QualityItem[]; cursor: string | null; done: boolean }> {
    const query = new URLSearchParams({
      before,
      ...(cursor ? { cursor } : {}),
    });
    return this.examSource(`exams?${query}`);
  }

  /** OK results are cached for 24 h; MISSING/UNVERIFIED are always re-probed. */
  private async probeUrls(
    client: Pick<PgConnection, 'query'>,
    urls: string[],
    useCache = true,
  ): Promise<Map<string, MediaOutcome>> {
    const cached = new Map<string, MediaOutcome>(
      !useCache ? [] : (
        await client.query(
          `SELECT url,outcome FROM public.content_quality_media_cache WHERE url=ANY($1::text[]) AND outcome='OK' AND checked_at>now()-interval '24 hours'`,
          [urls],
        )
      ).rows.map((row) => [row.url, row.outcome]),
    );
    const outcomes = await pooled(urls, MEDIA_PROBE_CONCURRENCY, async (url) => {
      const hit = cached.get(url);
      return { url, outcome: hit ?? (await this.media.probe(url)), fresh: !hit };
    });
    const fresh = outcomes.filter((row) => row.fresh);
    if (fresh.length)
      await client.query(
        `INSERT INTO public.content_quality_media_cache(url,outcome)
         SELECT x.url,x.outcome FROM jsonb_to_recordset($1::jsonb) AS x(url text,outcome text)
         ON CONFLICT(url) DO UPDATE SET outcome=EXCLUDED.outcome,checked_at=now()`,
        [JSON.stringify(fresh.map(({ url, outcome }) => ({ url, outcome })))],
      );
    return new Map(outcomes.map(({ url, outcome }) => [url, outcome]));
  }

  /** One transaction per bounded batch. The advisory + row lock also fence replicas.
   * Crash rolls back the batch; cursor and findings advance together on commit. */
  async processBatch() {
    this.owner();
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      const lock = await client.query(
        `SELECT pg_try_advisory_xact_lock(hashtextextended('vocalearn.content-quality',0)) AS locked`,
      );
      if (!lock.rows[0].locked) {
        await client.query('ROLLBACK');
        return;
      }
      const job = (
        await client.query(
          `SELECT * FROM public.content_quality_jobs WHERE state IN ('PENDING','RUNNING') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
        )
      ).rows[0];
      if (!job) {
        await client.query('COMMIT');
        return;
      }
      await client.query('SAVEPOINT batch');
      try {
        await client.query(
          `UPDATE public.content_quality_jobs SET state='RUNNING',updated_at=now() WHERE id=$1`,
          [job.id],
        );
        if (job.phase < 4) {
          const kind = QUALITY_KINDS[job.phase];
          const before = new Date(job.created_at).toISOString();
          const batch =
            kind === 'exams'
              ? await this.examBatch(job.cursor_id, before)
              : await this.source.batch(kind, job.cursor_id, before);
          // Set-based inserts (one statement per table per batch).
          const findings = batch.items.flatMap((item) =>
            item.issues.map((issue) => ({
              kind: item.kind,
              resource_id: item.id,
              title: item.title,
              category: issue.category,
              code: issue.code,
              path: issue.path,
              severity: issue.severity,
              message_vi: issue.messageVi,
              message_en: issue.messageEn,
              edit_path: item.editPath,
              content_updated_at: item.updatedAt,
            })),
          );
          if (findings.length)
            await client.query(
              `INSERT INTO public.content_quality_findings(job_id,kind,resource_id,title,category,code,path,severity,message_vi,message_en,edit_path,content_updated_at)
               SELECT $1,x.kind,x.resource_id,x.title,x.category,x.code,x.path,x.severity,x.message_vi,x.message_en,x.edit_path,x.content_updated_at
               FROM jsonb_to_recordset($2::jsonb) AS x(kind text,resource_id uuid,title text,category text,code text,path text,severity text,message_vi text,message_en text,edit_path text,content_updated_at timestamptz)`,
              [job.id, JSON.stringify(findings)],
            );
          // External URLs are recorded but never fetched (no finding, no HTTP).
          const links = batch.items.flatMap((item) =>
            item.media.map((asset) => ({
              kind: item.kind,
              resource_id: item.id,
              title: item.title,
              path: asset.path,
              url: asset.url,
              edit_path: item.editPath,
              content_updated_at: item.updatedAt,
              outcome: qualityMediaTarget(asset.url) ? null : 'EXTERNAL',
            })),
          );
          if (links.length)
            await client.query(
              `INSERT INTO public.content_quality_media_links(job_id,kind,resource_id,title,path,url,edit_path,content_updated_at,outcome)
               SELECT $1,x.kind,x.resource_id,x.title,x.path,x.url,x.edit_path,x.content_updated_at,x.outcome
               FROM jsonb_to_recordset($2::jsonb) AS x(kind text,resource_id uuid,title text,path text,url text,edit_path text,content_updated_at timestamptz,outcome text)
               ON CONFLICT DO NOTHING`,
              [job.id, JSON.stringify(links)],
            );
          await client.query(
            `UPDATE public.content_quality_jobs SET phase=$2,cursor_id=$3,scanned_count=scanned_count+$4,failures=0,error=NULL,updated_at=now() WHERE id=$1`,
            [
              job.id,
              job.phase + (batch.done ? 1 : 0),
              batch.done ? null : batch.cursor,
              batch.items.length,
            ],
          );
        } else {
          const urls = (
            await client.query(
              `SELECT DISTINCT url FROM public.content_quality_media_links WHERE job_id=$1 AND outcome IS NULL ORDER BY url LIMIT ${MEDIA_URLS_PER_TICK}`,
              [job.id],
            )
          ).rows.map((row) => row.url as string);
          const outcomes = await this.probeUrls(client, urls);
          if (outcomes.size)
            await client.query(
              `UPDATE public.content_quality_media_links m SET outcome=x.outcome
               FROM jsonb_to_recordset($2::jsonb) AS x(url text,outcome text)
               WHERE m.job_id=$1 AND m.url=x.url`,
              [job.id, JSON.stringify([...outcomes].map(([url, outcome]) => ({ url, outcome })))],
            );
          const pending = (
            await client.query(
              `SELECT 1 FROM public.content_quality_media_links WHERE job_id=$1 AND outcome IS NULL LIMIT 1`,
              [job.id],
            )
          ).rows.length;
          if (!pending) {
            await client.query(
              `INSERT INTO public.content_quality_findings(job_id,kind,resource_id,title,category,code,path,severity,message_vi,message_en,edit_path,content_updated_at)
              SELECT job_id,kind,resource_id,title,'MEDIA',CASE WHEN outcome='MISSING' THEN 'MEDIA_MISSING' ELSE 'MEDIA_UNVERIFIED' END,path,
                CASE WHEN outcome='MISSING' THEN 'error' ELSE 'warning' END,
                CASE WHEN outcome='MISSING' THEN 'Không tìm thấy file media (404/410).' ELSE 'Chưa xác minh được media của hệ thống: máy chủ media không phản hồi hoặc trả lỗi tạm thời.' END,
                CASE WHEN outcome='MISSING' THEN 'Media file not found (404/410).' ELSE 'Could not verify system media: the media server did not answer or returned a temporary error.' END,
                edit_path,content_updated_at FROM public.content_quality_media_links WHERE job_id=$1 AND outcome IN ('MISSING','UNVERIFIED')`,
              [job.id],
            );
            await client.query(
              `UPDATE public.content_quality_jobs SET state='COMPLETED',finished_at=now(),updated_at=now(),failures=0,error=NULL WHERE id=$1`,
              [job.id],
            );
            // Keep the newest two snapshots and only seven days of older history.
            await client.query(
              `DELETE FROM public.content_quality_jobs WHERE id IN (SELECT id FROM public.content_quality_jobs WHERE finished_at<now()-interval '7 days' ORDER BY finished_at LIMIT 20) AND id NOT IN (SELECT id FROM public.content_quality_jobs WHERE state='COMPLETED' ORDER BY finished_at DESC LIMIT 2)`,
            );
            await client.query(
              `DELETE FROM public.content_quality_media_cache WHERE checked_at<now()-interval '7 days'`,
            );
          } else
            await client.query(
              `UPDATE public.content_quality_jobs SET updated_at=now(),failures=0,error=NULL WHERE id=$1`,
              [job.id],
            );
        }
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT batch');
        await client.query(
          `UPDATE public.content_quality_jobs SET failures=failures+1,state=CASE WHEN failures>=2 THEN 'FAILED' ELSE 'RUNNING' END,error='SOURCE_UNAVAILABLE',updated_at=now(),finished_at=CASE WHEN failures>=2 THEN now() ELSE NULL END WHERE id=$1`,
          [job.id],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check one content item again without a full scan. The result is appended
   * to `content_quality_rechecks` (history is kept) and replaces this item's
   * findings in the report. A source/network failure stores nothing; a media
   * URL that cannot be reached this time keeps its previous MISSING finding.
   */
  async recheck(kind: string, id: string, actorId: string, language = 'vi') {
    this.owner();
    if (!(QUALITY_KINDS as string[]).includes(kind))
      throw new BadRequestException('Unsupported content type');
    const client = await this.db.pool.connect();
    let resolved = 0;
    try {
      await client.query('BEGIN');
      const lock = await client.query(
        `SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked`,
        [`vocalearn.content-quality.recheck:${kind}:${id}`],
      );
      if (!lock.rows[0].locked)
        throw new ConflictException({ code: 'RECHECK_RUNNING', message: 'This content is already being checked' });
      const item: QualityItem | null =
        kind === 'exams'
          ? await this.examSource(`exams/${encodeURIComponent(id)}`)
          : await this.source.one(kind as PublicationKind, id);
      const snapshot = await this.snapshot();
      const previous: StoredFinding[] = (
        await client.query(
          `WITH ${this.currentSql('vi')} SELECT category,code,path,severity,message AS message_vi,'' AS message_en FROM current WHERE kind=$3 AND resource_id=$4::uuid`,
          [snapshot?.id ?? null, snapshot?.finished_at ?? null, kind, id],
        )
      ).rows;
      const findings: StoredFinding[] = [];
      if (item) {
        for (const issue of item.issues)
          findings.push({
            category: issue.category,
            code: issue.code,
            path: issue.path,
            severity: issue.severity,
            message_vi: issue.messageVi,
            message_en: issue.messageEn,
          });
        const own = [...new Set(item.media.map((asset) => asset.url).filter((url) => qualityMediaTarget(url)))];
        if (own.length > RECHECK_MEDIA_LIMIT)
          throw new BadRequestException('Too many media references to check at once; run a full scan');
        // An explicit recheck verifies the files now (no cached result).
        const outcomes = await this.probeUrls(client, own, false);
        const wasMissing = new Set(previous.filter((f) => f.code === 'MEDIA_MISSING').map((f) => f.path));
        for (const asset of item.media) {
          const outcome = outcomes.get(asset.url);
          if (!outcome || outcome === 'OK') continue;
          // A transient failure never closes a confirmed missing-media finding.
          const missing = outcome === 'MISSING' || wasMissing.has(asset.path);
          findings.push({
            category: 'MEDIA',
            code: missing ? 'MEDIA_MISSING' : 'MEDIA_UNVERIFIED',
            path: asset.path,
            severity: missing ? 'error' : 'warning',
            message_vi: missing
              ? outcome === 'MISSING'
                ? 'Không tìm thấy file media (404/410).'
                : 'Không tìm thấy file media ở lần quét trước; lần kiểm tra này không kết nối được nên vẫn giữ lỗi.'
              : 'Chưa xác minh được media của hệ thống: máy chủ media không phản hồi hoặc trả lỗi tạm thời.',
            message_en: missing
              ? outcome === 'MISSING'
                ? 'Media file not found (404/410).'
                : 'Media was missing at the last scan; this check could not connect, so the error is kept.'
              : 'Could not verify system media: the media server did not answer or returned a temporary error.',
          });
        }
      }
      const now = new Set(findings.map((f) => `${f.code}|${f.path}`));
      resolved = previous.filter((f) => !now.has(`${f.code}|${f.path}`)).length;
      await client.query(
        `INSERT INTO public.content_quality_rechecks(kind,resource_id,actor_id,title,edit_path,content_updated_at,deleted,findings,resolved_count)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [
          kind,
          id,
          actorId,
          item?.title ?? '',
          item?.editPath ?? '',
          item?.updatedAt ?? null,
          !item,
          JSON.stringify(findings),
          resolved,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    const snapshot = await this.snapshot();
    const after = (
      await this.db.query(
        `WITH ${this.currentSql(language)}
        SELECT COUNT(*) FILTER(WHERE severity='error')::int AS errors,COUNT(*) FILTER(WHERE severity='warning')::int AS warnings
        FROM current WHERE kind=$3 AND resource_id=$4::uuid`,
        [snapshot?.id ?? null, snapshot?.finished_at ?? null, kind, id],
      )
    ).rows[0];
    return { kind, resourceId: id, resolved, ...after };
  }
}

