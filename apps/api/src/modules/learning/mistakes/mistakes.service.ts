import { Injectable,NotFoundException } from '@nestjs/common';
import type {
MistakeDetail,
MistakeItem,
MistakeList,
MistakeStatistic,
} from '@repo/shared-types/mistakes';
import {
InjectPgConnection,
type PgConnection,
} from '../../../postgres/connection.js';
import { mistakeSource } from './mistake-source-client.js';
import type { MistakesQueryDto } from './mistakes.dto.js';

const columns = `id,source_type AS "sourceType",source_item_id AS "sourceItemId",source_ref_id AS "sourceRefId",
  title,wrong_count AS "wrongCount",reviewed_count AS "reviewedCount",last_wrong_at AS "lastWrongAt",
  CASE WHEN wrong_count > reviewed_count THEN 'PENDING' ELSE 'REVIEWED' END AS status`;

@Injectable()
export class MistakesService {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}
  async list(userId: string, query: MistakesQueryDto): Promise<MistakeList> {
    const { rows } = await this.db.query(
      `WITH filtered AS (
      SELECT * FROM public.learning_mistakes WHERE user_id=$1
      AND ($2::text IS NULL OR source_type=$2)
      AND ($3::text IS NULL OR (wrong_count > reviewed_count)=($3='PENDING'))
      AND ($4::text IS NULL OR strpos(lower(title),lower($4)) > 0)
    ) SELECT (SELECT COUNT(*)::int FROM filtered) AS total,
      (SELECT COUNT(*)::int FROM public.learning_mistakes WHERE user_id=$1 AND wrong_count > reviewed_count) AS pending,
      COALESCE((SELECT jsonb_agg(item) FROM (SELECT ${columns} FROM filtered
        ORDER BY last_wrong_at DESC,id LIMIT $5 OFFSET $6) item),'[]'::jsonb) AS items`,
      [
        userId,
        query.source ?? null,
        query.status ?? null,
        query.q?.trim() || null,
        query.limit,
        (query.page - 1) * query.limit,
      ],
    );
    return { ...rows[0], page: query.page, limit: query.limit };
  }
  async owned(userId: string, id: string): Promise<MistakeItem> {
    const { rows } = await this.db.query(
      `SELECT ${columns} FROM public.learning_mistakes WHERE id=$1 AND user_id=$2`,
      [id, userId],
    );
    if (!rows[0]) throw new NotFoundException('Mistake not found');
    return rows[0];
  }
  async detail(userId: string, id: string): Promise<MistakeDetail> {
    const item = await this.owned(userId, id);
    const result = await mistakeSource<MistakeDetail>(
      item.sourceType === 'TOEIC' ? 'assessment' : 'content',
      'resolve',
      {
        userId,
        sourceType: item.sourceType,
        sourceItemId: item.sourceItemId,
        sourceRefId: item.sourceRefId,
      },
    );
    // Never pass the richer internal Word payload through the detail endpoint.
    return {
      available: result.available,
      title: result.title,
      explanation: result.explanation,
      correctAnswer: result.correctAnswer,
      selectedAnswer: result.selectedAnswer,
      reviewUrl: result.reviewUrl,
      actionUrl:
        item.sourceType === 'VOCABULARY' && result.available
          ? `/vocabulary/review?mistakeId=${id}`
          : result.actionUrl,
    };
  }
  async reviewWord(userId: string, id: string) {
    const item = await this.owned(userId, id);
    if (item.sourceType !== 'VOCABULARY')
      throw new NotFoundException('Vocabulary mistake not found');
    const result = await mistakeSource<
      MistakeDetail & { word?: Record<string, unknown> }
    >('content', 'resolve', {
      userId,
      sourceType: item.sourceType,
      sourceItemId: item.sourceItemId,
      sourceRefId: item.sourceRefId,
    });
    if (!result.available || !result.word)
      throw new NotFoundException('Content is no longer available');
    return [{ wordId: result.word }];
  }
  async markReviewed(userId: string, id: string, seenWrongCount: number) {
    const { rows } = await this.db.query(
      `UPDATE public.learning_mistakes SET
      reviewed_count=GREATEST(reviewed_count,LEAST(wrong_count,$3)),reviewed_at=now()
      WHERE id=$1 AND user_id=$2 RETURNING ${columns}`,
      [id, userId, seenWrongCount],
    );
    if (!rows[0]) throw new NotFoundException('Mistake not found');
    return rows[0] as MistakeItem;
  }
  async statistics(): Promise<{
    minimumLearners: number;
    items: MistakeStatistic[];
  }> {
    const { rows } = await this.db
      .query(`SELECT source_type AS "sourceType",source_item_id AS "sourceItemId",MAX(title) AS title,
      COUNT(DISTINCT user_id)::int AS learners,SUM(samples)::int AS samples,SUM(wrong_count)::int AS "wrongCount",
      ROUND(100.0*SUM(wrong_count)/NULLIF(SUM(samples),0),2)::float AS "errorRate"
      FROM public.learning_item_outcomes WHERE occurred_at >= now()-interval '30 days'
      GROUP BY source_type,source_item_id HAVING COUNT(DISTINCT user_id)>=20 AND SUM(wrong_count)>0
      ORDER BY "errorRate" DESC,SUM(wrong_count) DESC,source_type,source_item_id LIMIT 20`);
    return { minimumLearners: 20, items: rows };
  }
}
