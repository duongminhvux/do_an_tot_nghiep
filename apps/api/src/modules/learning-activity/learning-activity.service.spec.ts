import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createConnection, Types } from 'mongoose';
import { LearningActivityService } from './learning-activity.service.js';
import { LearningActivitySchema } from './schemas/learning-activity.schema.js';

describe.skipIf(!process.env.TOEIC_TEST_MONGO_URI)(
  'learning activity log',
  () => {
    const connection = createConnection();
    let service: LearningActivityService;

    beforeAll(async () => {
      await connection.openUri(process.env.TOEIC_TEST_MONGO_URI!);
      const model = connection.model(
        'LearningActivity',
        LearningActivitySchema,
        `learning_activities_${new Types.ObjectId()}`,
      );
      await model.syncIndexes();
      service = new LearningActivityService(model as never);
    });

    afterAll(async () => {
      vi.useRealTimers();
      await connection.close();
    });

    const base = (userId: string, sourceKey: string, occurredAt: Date) => ({
      userId,
      module: 'TOEIC' as const,
      type: 'TOEIC_ATTEMPT' as const,
      sourceKey,
      xp: 10,
      occurredAt,
    });

    it('records each source once', async () => {
      const user = String(new Types.ObjectId());
      const input = base(user, 'toeic:1', new Date());
      expect(await service.record(input)).toBe(true);
      expect(await service.record({ ...input, xp: 99 })).toBe(false);
      const recent = await service.recent(user);
      expect(recent).toHaveLength(1);
      expect(recent[0]).toMatchObject({ xp: 10, module: 'TOEIC' });
      expect(recent[0]).not.toHaveProperty('sourceKey');
    });

    it('buckets days in the learner time zone and computes streaks and growth', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      // 2026-10-22 10:00 in Vietnam (UTC+7).
      vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
      const user = String(new Types.ObjectId());
      const at = (iso: string) => new Date(iso);
      await Promise.all([
        // 22/10 00:30 Vietnam = 21/10 17:30 UTC: must count as "today".
        service.record(base(user, 'a', at('2026-10-21T17:30:00Z'))),
        service.record({
          ...base(user, 'b', at('2026-10-21T10:00:00Z')),
          module: 'ARENA',
          type: 'ARENA_MATCH',
          xp: 20,
          durationSec: 120,
        }),
        service.record(base(user, 'c', at('2026-10-20T10:00:00Z'))),
        // gap on 19/10, then an older 3-day run (longest streak).
        service.record(base(user, 'd', at('2026-10-16T10:00:00Z'))),
        service.record(base(user, 'e', at('2026-10-15T10:00:00Z'))),
        service.record(base(user, 'f', at('2026-10-14T10:00:00Z'))),
        service.record(base(user, 'g', at('2026-10-13T10:00:00Z'))),
        service.record(base(user, 'h', at('2026-10-10T10:00:00Z'))),
      ]);
      const home = await service.home(user, 'Asia/Ho_Chi_Minh');
      vi.useRealTimers();
      expect(home.today).toMatchObject({
        date: '2026-10-22',
        xp: 10,
        goalXp: 50,
        activities: 1,
      });
      expect(home.streak).toEqual({
        current: 3,
        longest: 4,
        activeToday: true,
      });
      expect(home.totals).toMatchObject({ xp: 90, count: 8, activeDays: 8 });
      expect(home.byModule.ARENA).toEqual({
        xp: 20,
        count: 1,
        durationSec: 120,
      });
      // Last 7 days (16-22/10): a,b,c,d = 50 XP; previous 7 (9-15/10): e,f,g,h = 40.
      expect(home.week).toMatchObject({ xp: 50, count: 4 });
      expect(home.growth.xp).toBe(25);
      const yesterday = home.heatmap.find((d) => d.date === '2026-10-21');
      expect(yesterday).toMatchObject({ xp: 20, count: 1 });
      expect(yesterday?.byModule.ARENA).toMatchObject({ count: 1 });
    });

    it('keeps the streak alive until the day ends and pages recent activity', async () => {
      const user = String(new Types.ObjectId());
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await service.record(base(user, 'y', yesterday));
      const home = await service.home(user);
      expect(home.streak).toMatchObject({ current: 1, activeToday: false });
      await service.record(base(user, 'z', new Date()));
      const [latest] = await service.recent(user, 1);
      const older = await service.recent(
        user,
        10,
        new Date(latest!.occurredAt),
      );
      expect(older).toHaveLength(1);
    });
  },
);
