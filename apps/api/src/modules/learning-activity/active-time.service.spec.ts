import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ActiveTimeService } from './active-time.service.js';
import { ActiveTimePulseDto } from './learning-activity.controller.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

it('rejects arbitrary identities and unbounded duration payloads', async () => {
  for (const value of [
    { requestId: 'bad', activeMs: 10 },
    { requestId: randomUUID(), activeMs: 259200000 },
    { requestId: randomUUID(), activeMs: -1 },
    { requestId: randomUUID(), activeMs: 1.5 },
  ]) {
    expect(
      (await validate(plainToInstance(ActiveTimePulseDto, value))).length,
    ).toBeGreaterThan(0);
  }
  expect(
    await validate(
      plainToInstance(ActiveTimePulseDto, {
        requestId: randomUUID(),
        activeMs: 15000,
      }),
    ),
  ).toEqual([]);
});

describe.runIf(Boolean(process.env.ACTIVE_TIME_TEST_DATABASE_URL))(
  'active time PostgreSQL integration',
  () => {
    const pool = new Pool({
      connectionString: process.env.ACTIVE_TIME_TEST_DATABASE_URL,
    });
    const service = new ActiveTimeService({
      pool,
      query: (sql, params) => pool.query(sql, params),
    });
    const users: string[] = [];
    const user = () => {
      const id = randomUUID();
      users.push(id);
      return id;
    };
    const prime = async (id: string, gapMs: number) =>
      pool.query(
        "INSERT INTO public.user_active_time_state(user_id,last_seen_at) VALUES($1,clock_timestamp()-$2*interval '1 millisecond')",
        [id, gapMs],
      );
    afterAll(async () => {
      await pool.query(
        'DELETE FROM public.user_active_time_slices WHERE user_id=ANY($1::uuid[])',
        [users],
      );
      await pool.query(
        'DELETE FROM public.user_active_time_state WHERE user_id=ANY($1::uuid[])',
        [users],
      );
      await pool.end();
    });
    it('starts at zero instead of accepting an initial claimed duration', async () => {
      expect(
        await service.record(user(), {
          requestId: randomUUID(),
          activeMs: 30000,
        }),
      ).toEqual({ acceptedMs: 0 });
    });
    it('caps credits at server elapsed time and handles retries exactly once', async () => {
      const id = user();
      await prime(id, 5000);
      const pulse = { requestId: randomUUID(), activeMs: 30000 };
      const result = await service.record(id, pulse);
      expect(result.acceptedMs).toBeGreaterThanOrEqual(5000);
      expect(result.acceptedMs).toBeLessThan(7000);
      expect(await service.record(id, pulse)).toEqual(result);
      const rows = await pool.query(
        'SELECT * FROM public.user_active_time_slices WHERE user_id=$1',
        [id],
      );
      expect(rows.rowCount).toBe(1);
    });
    it('never fills the multi-day gap left by an abandoned test', async () => {
      const id = user();
      await prime(id, 3 * 86400000);
      expect(
        await service.record(id, { requestId: randomUUID(), activeMs: 15000 }),
      ).toEqual({ acceptedMs: 15000 });
    });
    it('serializes concurrent tabs so credited intervals cannot overlap', async () => {
      const id = user();
      await prime(id, 5000);
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          service.record(id, { requestId: randomUUID(), activeMs: 30000 }),
        ),
      );
      expect(
        results.reduce((sum, result) => sum + result.acceptedMs, 0),
      ).toBeLessThan(7000);
      const overlap = await pool.query(
        `SELECT count(*)::int AS count FROM public.user_active_time_slices a
       JOIN public.user_active_time_slices b ON a.user_id=b.user_id AND a.request_id<b.request_id
       AND a.started_at<b.ended_at AND b.started_at<a.ended_at WHERE a.user_id=$1`,
        [id],
      );
      expect(overlap.rows[0].count).toBe(0);
    });
    it('splits a slice at midnight in the requested timezone and isolates users', async () => {
      const id = user();
      await pool.query(
        'INSERT INTO public.user_active_time_slices VALUES($1,$2,$3,$4)',
        [id, randomUUID(), '2026-10-24T16:59:50Z', '2026-10-24T17:00:10Z'],
      );
      expect(await service.daily(id, 'Asia/Ho_Chi_Minh')).toEqual(
        new Map([
          ['2026-10-24', 10],
          ['2026-10-25', 10],
        ]),
      );
      expect(await service.daily(id, 'UTC')).toEqual(
        new Map([['2026-10-24', 20]]),
      );
      expect(await service.daily(user(), 'UTC')).toEqual(new Map());
    });
  },
);
