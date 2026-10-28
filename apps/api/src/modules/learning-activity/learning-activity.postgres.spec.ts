import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { databaseSuite } from '../../../test/native-database.js';
import { ActiveTimeService } from './active-time.service.js';
import { LearningActivityService } from './learning-activity.service.js';

const suite = databaseSuite('learning');
afterEach(() => vi.useRealTimers());

it('groups home activity by local day and module without leaking another user', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T08:00:00Z'));
  const service = new LearningActivityService(suite.db, new ActiveTimeService(suite.db));
  const userId = randomUUID();
  for (const [index, occurredAt] of [
    '2026-10-27T16:59:00Z',
    '2026-10-27T17:01:00Z',
    '2026-10-27T17:02:00Z',
  ].entries()) {
    await service.record({
      userId,
      module: 'TOEIC',
      type: index === 2 ? 'WORD_REVIEWED' : 'TOEIC_ATTEMPT',
      sourceKey: `home-test:${index}`,
      xp: 10,
      occurredAt: new Date(occurredAt),
    });
  }
  await service.record({
    userId,
    module: 'ARENA',
    type: 'ARENA_MATCH',
    sourceKey: 'home-test:arena',
    xp: 5,
    occurredAt: new Date('2026-10-27T17:03:00Z'),
  });
  await service.record({
    userId: randomUUID(),
    module: 'TOEIC',
    type: 'TOEIC_ATTEMPT',
    sourceKey: 'home-test:other-user',
    xp: 100,
  });

  const local = await service.home(userId, 'Asia/Ho_Chi_Minh');
  expect(local.totals).toEqual({ xp: 35, count: 3, durationSec: 0, activeDays: 2 });
  expect(local.byModule.TOEIC).toEqual({ xp: 30, count: 2, durationSec: 0 });
  expect(local.byModule.ARENA).toEqual({ xp: 5, count: 1, durationSec: 0 });
  expect(local.heatmap.map(({ date, xp, count }) => ({ date, xp, count }))).toEqual([
    { date: '2026-10-27', xp: 10, count: 1 },
    { date: '2026-10-28', xp: 25, count: 2 },
  ]);

  const utc = await service.home(userId, 'UTC');
  expect(utc.totals.activeDays).toBe(1);
  expect(utc.heatmap.map(({ date, xp, count }) => ({ date, xp, count }))).toEqual([
    { date: '2026-10-27', xp: 35, count: 3 },
  ]);
  const empty = await service.home(randomUUID(), 'Asia/Ho_Chi_Minh');
  expect(empty.totals).toEqual({ xp: 0, count: 0, durationSec: 0, activeDays: 0 });
  expect(empty.heatmap).toEqual([]);
});
