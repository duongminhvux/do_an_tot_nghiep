import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { InjectPgConnection, type PgConnection } from '../postgres/connection.js';
import { serviceRole } from '../postgres/ownership.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { readRecommendationRules } from '../modules/learning/recommendations/recommendation-settings.js';

export function authorizeRecommendationSummary(token: string, roles: string[]) {
  const expected = Buffer.from(process.env.INTERNAL_SERVICE_TOKEN ?? '');
  const actual = Buffer.from(token ?? '');
  if (
    !roles.includes(serviceRole() ?? '') ||
    expected.length < 24 ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    throw new ForbiddenException();
}

/** Narrow owner-side projections: no raw attempts, transcripts or answer keys leave the owner. */
@Controller('_internal/learning-recommendations')
export class RecommendationSummaryController {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}

  @Public()
  @Get('rules')
  rules(@Headers('x-internal-token') token: string) {
    authorizeRecommendationSummary(token, ['media-jobs']);
    return readRecommendationRules(this.db);
  }

  @Public()
  @Get(':userId')
  async summary(
    @Headers('x-internal-token') token: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    authorizeRecommendationSummary(token, ['assessment', 'content']);
    if (serviceRole() === 'assessment') {
      const { rows } = await this.db.query(
        `
        WITH recent AS (
          SELECT payload->'partResults' AS parts FROM public.attempts
          WHERE user_id = $1 AND status IN ('FINISHED', 'COMPLETED')
            AND completed_at >= now() - interval '30 days'
          ORDER BY completed_at DESC LIMIT 100
        ), scores AS (
          SELECT (p->>'part')::int AS part, COUNT(*)::int AS samples,
            SUM((p->>'total')::int)::int AS total, SUM((p->>'correct')::int)::int AS correct
          FROM recent CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(parts) = 'array' THEN parts ELSE '[]'::jsonb END) p
          WHERE p->>'part' ~ '^[1-7]$' AND p->>'total' ~ '^[0-9]{1,4}$' AND p->>'correct' ~ '^[0-9]{1,4}$'
          GROUP BY p->>'part'
        )
        SELECT s.*, target.url AS "actionUrl" FROM scores s
        LEFT JOIN LATERAL (
          SELECT '/toeic/' || g.slug || '/' || e.slug || '?practicePart=' || s.part AS url
          FROM public.exams e JOIN public.examgroups g ON g.id = e.group_id
          WHERE e.type = 'TOEIC' AND e.publication_status='PUBLISHED' AND e.is_active IS TRUE AND e.is_deleted IS NOT TRUE
            AND g.is_active IS TRUE AND g.is_deleted IS NOT TRUE
            AND EXISTS (SELECT 1 FROM public.questions q WHERE q.exam_id = e.id AND q.part = s.part AND q.is_active IS TRUE)
            AND NOT EXISTS (
              SELECT 1 FROM public.questions q WHERE q.exam_id = e.id AND q.part = s.part AND q.is_active IS NOT FALSE
              AND ((q.part <= 4 AND COALESCE(q.audio_url, '') = '' AND NOT EXISTS (
                SELECT 1 FROM public.passages p WHERE p.passage_group_id = q.passage_group_id AND COALESCE(p.audio_url, '') <> ''
              )) OR (q.part = 1 AND COALESCE(q.image_url, '') = ''))
            )
            AND NOT EXISTS (SELECT 1 FROM public.attempts a WHERE a.user_id = $1 AND a.exam_id = e.id
              AND a.status IN ('FINISHED', 'COMPLETED') AND a.completed_at > now() - interval '1 day')
          ORDER BY e."order" NULLS LAST, e.id LIMIT 1
        ) target ON true WHERE s.total > 0 AND s.correct <= s.total ORDER BY s.part
      `,
        [userId],
      );
      return rows;
    }
    const { rows } = await this.db.query(
      `
      WITH recent AS (
        SELECT segment_progress FROM public.dictationprogresses
        WHERE user_id = $1 AND completed IS TRUE AND last_practiced_at >= now() - interval '30 days'
        ORDER BY last_practiced_at DESC LIMIT 100
      ), scores AS (
        SELECT COUNT(DISTINCT r.ordinality)::int AS samples, COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE segment->>'firstTryCorrect' = 'true')::int AS correct
        FROM (SELECT segment_progress, row_number() OVER () AS ordinality FROM recent) r
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.segment_progress, '[]'::jsonb)) segment
        WHERE segment->>'correct' = 'true' OR segment->>'revealed' = 'true'
      )
      SELECT s.*, target.url AS "actionUrl", target.minutes AS "estimatedMinutes" FROM scores s
      LEFT JOIN LATERAL (
        SELECT '/dictation/' || l.slug AS url,
          GREATEST(2, CEIL(l.total_duration_ms / 60000 * 3))::int AS minutes
        FROM public.dictationlessons l
        WHERE l.status = 'PUBLISHED' AND l.publication_status='PUBLISHED' AND l.is_deleted IS NOT TRUE AND l.sentence_count > 0
          AND l.total_duration_ms > 0 AND l.total_duration_ms <= 180000
          AND COALESCE(l.full_audio_url, '') <> ''
          AND NOT EXISTS (SELECT 1 FROM public.dictationprogresses p
            WHERE p.user_id = $1 AND p.lesson_id = l.id AND p.completed IS TRUE
              AND p.last_practiced_at > now() - interval '1 day')
        ORDER BY l.total_duration_ms NULLS LAST, l.id LIMIT 1
      ) target ON true
    `,
      [userId],
    );
    return rows[0];
  }
}
