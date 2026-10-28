import { afterEach, expect, it, vi } from 'vitest';
import { LearningActivityService } from './learning-activity.service.js';

afterEach(() => vi.useRealTimers());
it('home uses only active website time, without turning time-only days into learning streaks', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-25T08:00:00Z'));
  const rows = [
    {
      _id: { day: '2026-10-24', module: 'TOEIC' },
      xp: 10,
      count: 1,
      durationSec: 259200,
    },
  ];
  const model = {query:async()=>({rows})};
  const activeTime = {
    daily: async () =>
      new Map([
        ['2026-10-25', 40],
        ['2026-10-24', 20],
        ['2026-10-17', 10],
      ]),
  };
  const service = new LearningActivityService(
    model as never,
    activeTime as never,
  );
  const home = await service.home(
    '00000000-0000-4000-8000-000000000001',
    'Asia/Ho_Chi_Minh',
  );
  expect(home.today.durationSec).toBe(40);
  expect(home.week.durationSec).toBe(60);
  expect(home.totals.durationSec).toBe(70);
  expect(home.growth.durationSec).toBe(500);
  expect(home.byModule.TOEIC.durationSec).toBe(0);
  expect(home.streak).toEqual({ current: 1, longest: 1, activeToday: false });
  expect(home.totals.activeDays).toBe(1);
  expect(home.week.count).toBe(1);
  expect(home.heatmap[0].durationSec).toBe(20);
});
it('does not reuse historical elapsed test durations when active-time records are absent', async () => {
  const model={query:async()=>({rows:[
        {
          _id: { day: '2026-10-25', module: 'TOEIC' },
          xp: 10,
          count: 1,
          durationSec: 259200,
        },
      ]})};
  const service = new LearningActivityService(
    model as never,
    { daily: async () => new Map() } as never,
  );
  const home = await service.home(
    '00000000-0000-4000-8000-000000000001',
    'UTC',
  );
  expect(home.totals.durationSec).toBe(0);
  expect(home.week.durationSec).toBe(0);
});
