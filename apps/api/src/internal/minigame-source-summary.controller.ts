import { Controller, ForbiddenException, Get, Headers, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { InjectPgConnection, type PgConnection } from '../postgres/compat.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { serviceRole } from '../postgres/ownership.js';

/** Narrow Content-owned projection. Does not expose lesson, word or user rows. */
@Injectable()
@Controller('_internal/minigame-source-summary')
export class MiniGameSourceSummaryController {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}

  @Public()
  @Get()
  async list(@Headers('x-internal-token') token: string) {
    if (serviceRole() !== 'content') throw new ForbiddenException();
    const expected = Buffer.from(process.env.INTERNAL_SERVICE_TOKEN ?? '');
    const actual = Buffer.from(token ?? '');
    if (expected.length < 24 || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ForbiddenException();
    }
    const { rows } = await this.db.query(`
      SELECT c.id, c.name, c.cover_url AS "coverUrl",
        COUNT(DISTINCT LOWER(BTRIM(w.word))) FILTER (
          WHERE w.id IS NOT NULL AND w.word ~ '^[A-Za-z]+([ ''-][A-Za-z]+)*$'
            AND LENGTH(w.word) <= 48
        )::integer AS "wordCount"
      FROM public.collections c
      LEFT JOIN public.lessons l ON l.collection_id = c.id
        AND l.is_active IS TRUE AND l.is_deleted IS NOT TRUE
      LEFT JOIN public.lessonwords lw ON lw.lesson_id = l.id
      LEFT JOIN public.words w ON w.id = lw.word_id
        AND w.is_active IS TRUE AND w.is_deleted IS NOT TRUE
      WHERE c.is_active IS TRUE AND c.is_deleted IS NOT TRUE
      GROUP BY c.id, c.name, c.cover_url, c."order"
      ORDER BY c."order" ASC NULLS LAST, c.name ASC
      LIMIT 500
    `);
    return rows;
  }
}
