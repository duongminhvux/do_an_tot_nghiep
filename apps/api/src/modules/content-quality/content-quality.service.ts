import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  InjectPgConnection,
  type PgConnection,
} from '../../postgres/connection.js';
import { serviceRole, serviceUrl } from '../../postgres/ownership.js';
import { QualitySourceService } from './quality-source.service.js';
import { QualityMediaService } from './quality-media.service.js';
import {
  QUALITY_KINDS,
  type QualityCategory,
  type QualityItem,
} from './quality-rules.js';

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
  async list(category?: QualityCategory, page = 1, language = 'vi') {
    this.owner();
    const latest =
      (
        await this.db.query(
          `SELECT * FROM public.content_quality_jobs ORDER BY created_at DESC,id DESC LIMIT 1`,
        )
      ).rows[0] ?? null;
    const snapshot =
      (
        await this.db.query(
          `SELECT id,finished_at FROM public.content_quality_jobs WHERE state='COMPLETED' ORDER BY finished_at DESC,id DESC LIMIT 1`,
        )
      ).rows[0] ?? null;
    const stats = snapshot
      ? (
          await this.db.query(
            `SELECT
      COUNT(DISTINCT (kind,resource_id))::int AS "needsReview",
      COUNT(DISTINCT (kind,resource_id)) FILTER(WHERE category='MEDIA' AND code='AUDIO_REQUIRED')::int AS "missingAudio",
      COUNT(DISTINCT (kind,resource_id)) FILTER(WHERE category='DUPLICATE')::int AS duplicates,
      COUNT(DISTINCT (kind,resource_id)) FILTER(WHERE category='FEEDBACK')::int AS feedback
      FROM public.content_quality_findings WHERE job_id=$1`,
            [snapshot.id],
          )
        ).rows[0]
      : { needsReview: 0, missingAudio: 0, duplicates: 0, feedback: 0 };
    const params = [snapshot?.id ?? null, category ?? null];
    const count = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM public.content_quality_findings WHERE job_id=$1 AND ($2::text IS NULL OR category=$2)`,
      params,
    );
    const result = await this.db.query(
      `SELECT id::text,kind,resource_id AS "resourceId",title,category,code,path,severity,
      ${language === 'en' ? 'message_en' : 'message_vi'} AS message,edit_path AS "editPath",content_updated_at AS "updatedAt",checked_at AS "checkedAt"
      FROM public.content_quality_findings WHERE job_id=$1 AND ($2::text IS NULL OR category=$2) ORDER BY id LIMIT 20 OFFSET $3`,
      [...params, (page - 1) * 20],
    );
    return {
      items: result.rows,
      total: count.rows[0].total,
      page,
      pageSize: 20,
      stats,
      job: latest,
      snapshotAt: snapshot?.finished_at ?? null,
      stale:
        !snapshot ||
        Date.now() - new Date(snapshot.finished_at).getTime() > 86400000,
      feedbackAvailable: false,
    };
  }
  private async examBatch(
    cursor: string | null,
    before: string,
  ): Promise<{ items: QualityItem[]; cursor: string | null; done: boolean }> {
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!token || token.length < 24)
      throw new ServiceUnavailableException('Quality source unavailable');
    const query = new URLSearchParams({
      before,
      ...(cursor ? { cursor } : {}),
    });
    const response = await fetch(
      `${serviceUrl('assessment')}/api/_internal/content-quality/exams?${query}`,
      {
        headers: { 'x-internal-token': token },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new ServiceUnavailableException('Quality source unavailable');
    const body = await response.json();
    return body.data ?? body;
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
          for (const item of batch.items) {
            for (const issue of item.issues)
              await client.query(
                `INSERT INTO public.content_quality_findings(job_id,kind,resource_id,title,category,code,path,severity,message_vi,message_en,edit_path,content_updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                [
                  job.id,
                  item.kind,
                  item.id,
                  item.title,
                  issue.category,
                  issue.code,
                  issue.path,
                  issue.severity,
                  issue.messageVi,
                  issue.messageEn,
                  item.editPath,
                  item.updatedAt,
                ],
              );
            for (const asset of item.media)
              await client.query(
                `INSERT INTO public.content_quality_media_links(job_id,kind,resource_id,title,path,url,edit_path,content_updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
                [
                  job.id,
                  item.kind,
                  item.id,
                  item.title,
                  asset.path,
                  asset.url,
                  item.editPath,
                  item.updatedAt,
                ],
              );
          }
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
          // Four distinct URLs per tick, at most four HEAD requests concurrently.
          const urls = (
            await client.query(
              `SELECT DISTINCT url FROM public.content_quality_media_links WHERE job_id=$1 AND outcome IS NULL ORDER BY url LIMIT 4`,
              [job.id],
            )
          ).rows;
          const cachedRows = (
            await client.query(
              `SELECT url,outcome FROM public.content_quality_media_cache WHERE url=ANY($1::text[]) AND outcome='OK' AND checked_at>now()-interval '24 hours'`,
              [urls.map((row) => row.url)],
            )
          ).rows;
          const cache = new Map(
            cachedRows.map((row) => [row.url, row.outcome]),
          );
          const outcomes = await Promise.all(
            urls.map(async ({ url }) => {
              const cached = cache.get(url);
              return {
                url,
                outcome: cached ?? (await this.media.probe(url)),
                fresh: !cached,
              };
            }),
          );
          for (const { url, outcome, fresh } of outcomes) {
            if (fresh)
              await client.query(
                `INSERT INTO public.content_quality_media_cache(url,outcome) VALUES($1,$2) ON CONFLICT(url) DO UPDATE SET outcome=EXCLUDED.outcome,checked_at=now()`,
                [url, outcome],
              );
            await client.query(
              `UPDATE public.content_quality_media_links SET outcome=$3 WHERE job_id=$1 AND url=$2`,
              [job.id, url, outcome],
            );
          }
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
                CASE WHEN outcome='MISSING' THEN 'Không tìm thấy file media (404/410).' ELSE 'Chưa xác minh được media: URL ngoài phạm vi, chuyển hướng hoặc máy chủ không phản hồi.' END,
                CASE WHEN outcome='MISSING' THEN 'Media file not found (404/410).' ELSE 'Media could not be verified: external URL, redirect or unavailable server.' END,
                edit_path,content_updated_at FROM public.content_quality_media_links WHERE job_id=$1 AND outcome<>'OK'`,
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
}
