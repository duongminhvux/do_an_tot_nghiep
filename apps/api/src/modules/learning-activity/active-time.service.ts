import { BadRequestException, Injectable } from '@nestjs/common';
import {
  InjectPgConnection,
  type PgConnection,
} from '../../postgres/compat.js';
import { ACTIVE_TIME_MAX_SLICE_MS } from '@repo/shared-types/active-time';
import type { ActiveTimePulse } from '@repo/shared-types/active-time';

@Injectable()
export class ActiveTimeService {
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
  ) {}

  async record(userId: string, pulse: ActiveTimePulse) {
    if (
      !Number.isInteger(pulse.activeMs) ||
      pulse.activeMs < 0 ||
      pulse.activeMs > ACTIVE_TIME_MAX_SLICE_MS
    )
      throw new BadRequestException('Invalid active time interval');
    const client = await this.connection.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize all tabs/devices for one user, including across service replicas.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('active-time:' || $1, 0))",
        [userId],
      );
      const duplicate = await client.query<{ active_ms: string }>(
        `SELECT EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000 AS active_ms
         FROM public.user_active_time_slices WHERE user_id=$1::uuid AND request_id=$2::uuid`,
        [userId, pulse.requestId],
      );
      if (duplicate.rows.length) {
        await client.query('COMMIT');
        return { acceptedMs: Number(duplicate.rows[0].active_ms) };
      }
      const state = await client.query<{ last_seen_at: Date }>(
        'SELECT last_seen_at FROM public.user_active_time_state WHERE user_id=$1::uuid',
        [userId],
      );
      const clock = await client.query<{ now: Date }>(
        'SELECT clock_timestamp() AS now',
      );
      const now = clock.rows[0].now;
      const previous = state.rows[0]?.last_seen_at;
      const elapsed = previous
        ? Math.max(0, now.getTime() - previous.getTime())
        : 0;
      // A new tracker only establishes a baseline. A late pulse never fills an idle gap.
      const acceptedMs = Math.min(
        pulse.activeMs,
        elapsed,
        ACTIVE_TIME_MAX_SLICE_MS,
      );
      await client.query(
        `INSERT INTO public.user_active_time_state(user_id,last_seen_at) VALUES($1::uuid,$2)
         ON CONFLICT(user_id) DO UPDATE SET last_seen_at=GREATEST(user_active_time_state.last_seen_at,EXCLUDED.last_seen_at)`,
        [userId, now],
      );
      await client.query(
        `INSERT INTO public.user_active_time_slices(user_id,request_id,started_at,ended_at)
         VALUES($1::uuid,$2::uuid,$3,$4)`,
        [userId, pulse.requestId, new Date(now.getTime() - acceptedMs), now],
      );
      await client.query('COMMIT');
      return { acceptedMs };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async daily(userId: string, timezone: string) {
    // Split the short UTC intervals at local midnight; changing site timezone is safe.
    const result = await this.connection.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day,
         SUM(EXTRACT(EPOCH FROM (
           LEAST(ended_at, (day + interval '1 day') AT TIME ZONE $2)
           - GREATEST(started_at, day AT TIME ZONE $2)
         )))::double precision AS duration_sec
       FROM public.user_active_time_slices
       CROSS JOIN LATERAL generate_series(
         date_trunc('day', started_at AT TIME ZONE $2),
         date_trunc('day', ended_at AT TIME ZONE $2), interval '1 day'
       ) AS day
       WHERE user_id=$1::uuid AND ended_at > started_at
       GROUP BY day ORDER BY day`,
      [userId, timezone],
    );
    return new Map<string, number>(
      result.rows.map((row) => [row.day, Number(row.duration_sec)]),
    );
  }
}
