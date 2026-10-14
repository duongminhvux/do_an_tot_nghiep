import { Types } from 'mongoose';
import { ArenaReadService, arenaPeriodStart } from './arena-read.service.js';
import { ArenaService, arenaTodayRange } from './arena.service.js';

vi.mock('./schemas/arena-match.schema.js', () => ({
  ArenaMatch: class {},
  ArenaMatchStatus: { FINISHED: 'FINISHED' },
  ArenaMatchType: { RANK: 'RANK', FRIEND: 'FRIEND' },
}));
vi.mock('./schemas/arena-match-player.schema.js', () => ({
  ArenaMatchPlayer: class {},
}));
vi.mock('./schemas/arena-profile.schema.js', () => ({
  ArenaProfile: class {},
}));
vi.mock('./schemas/arena-rating-history.schema.js', () => ({
  ArenaRatingHistory: class {},
}));
vi.mock('../users/schema/user.schema.js', () => ({ User: class {} }));

const userId = '507f1f77bcf86cd799439011';
function fixture() {
  const aggregate = vi.fn().mockResolvedValue([]);
  const players = { collection: { name: 'players' }, aggregate };
  const service = new ArenaReadService(
    players as never,
    { collection: { name: 'matches' } } as never,
    { collection: { name: 'profiles' } } as never,
    { collection: { name: 'users' } } as never,
  );
  return { service, aggregate };
}

describe('Arena DB reads', () => {
  it('restricts leaderboard eligibility to actual completed ranked matches before grouping users', async () => {
    const f = fixture();
    await f.service.getLeaderboard(userId, 'all');
    const pipeline = f.aggregate.mock.calls[0][0];
    expect(pipeline).toContainEqual({
      $match: { 'match.status': 'FINISHED', 'match.type': 'RANK' },
    });
    expect(pipeline).toContainEqual({
      $match: { 'user.isDeleted': { $ne: true } },
    });
    expect(
      pipeline.findIndex((stage: Record<string, unknown>) => '$group' in stage),
    ).toBeGreaterThan(2);
    // Profiles are only looked up after eligibility; a newly created high-rated profile is never a candidate.
    expect(pipeline[0].$lookup.from).toBe('matches');
    expect(pipeline[3].$group._id).toBe('$userId');
  });

  it('keeps personal position and total outside the top-player limit and uses DB rating', async () => {
    const f = fixture();
    f.aggregate.mockResolvedValue([
      {
        players: [],
        me: [{ userId, position: 12, rating: 1000 }],
        total: [{ count: 30 }],
      },
    ]);
    const result = await f.service.getLeaderboard(userId, 'all', 5);
    expect(result).toMatchObject({ me: { position: 12 }, totalPlayers: 30 });
    const pipeline = f.aggregate.mock.calls[0][0];
    expect(pipeline.at(-1)).toEqual({
      $facet: {
        players: [{ $limit: 5 }],
        me: [{ $match: { userId } }, { $limit: 1 }],
        total: [{ $count: 'count' }],
      },
    });
    expect(pipeline).toContainEqual({
      $setWindowFields: {
        sortBy: { rating: -1 },
        output: { position: { $rank: {} } },
      },
    });
  });

  it('returns no fake rank for a user without a completed rank match', async () => {
    const f = fixture();
    expect(await f.service.getLeaderboard(userId)).toEqual({
      period: 'week',
      players: [],
      me: null,
      totalPlayers: 0,
    });
  });

  it('limits history to the authenticated user, sorts newest first and includes draws', async () => {
    const f = fixture();
    await f.service.getRecentMatches(userId, 20);
    const pipeline = f.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({
      $match: { userId: new Types.ObjectId(userId) },
    });
    expect(pipeline).toContainEqual({ $match: { 'match.status': 'FINISHED' } });
    expect(pipeline).toContainEqual({
      $sort: { 'match.finishedAt': -1, matchId: -1 },
    });
    expect(pipeline).toContainEqual({ $limit: 20 });
    expect(pipeline.at(-1).$project.result.$cond[1]).toBe('DRAW');
    expect(pipeline.at(-1).$project).not.toHaveProperty('email');
  });

  it('derives rank statistics and streaks from finished matches rather than profile counters', async () => {
    const f = fixture();
    f.aggregate.mockResolvedValue([
      {
        matches: 5,
        wins: 3,
        draws: 1,
        outcomes: [true, false, false, true, true],
      },
    ]);
    expect(await f.service.getRankedStatistics(userId)).toEqual({
      matches: 5,
      wins: 3,
      losses: 1,
      draws: 1,
      winRate: 60,
      currentWinStreak: 2,
      bestWinStreak: 2,
    });
  });

  it('rejects bad periods, IDs and unbounded query limits before querying', async () => {
    const f = fixture();
    await expect(f.service.getLeaderboard(userId, 'invalid')).rejects.toThrow(
      'Invalid ranking period',
    );
    await expect(f.service.getRecentMatches('invalid')).rejects.toThrow(
      'Invalid user ID',
    );
    for (const limit of [0, -1, 51, 1.5, NaN])
      await expect(f.service.getRecentMatches(userId, limit)).rejects.toThrow(
        'Limit must be',
      );
    expect(f.aggregate).not.toHaveBeenCalled();
  });

  it('includes the period cutoff for weekly and monthly eligibility', async () => {
    const f = fixture();
    await f.service.getLeaderboard(userId, 'month');
    expect(
      f.aggregate.mock.calls[0][0][2].$match['match.finishedAt'].$gte,
    ).toEqual(arenaPeriodStart('month'));
  });

  it.each([24, -16, 0])(
    'profile returns current Elo separately from today change %s',
    async (change) => {
      const read = {
        getLeaderboard: vi
          .fn()
          .mockResolvedValue({ me: { position: 2 }, totalPlayers: 10 }),
        getRankedStatistics: vi.fn().mockResolvedValue({
          matches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          currentWinStreak: 0,
          bestWinStreak: 0,
        }),
      };
      const service = new ArenaService(
        read as never,
        {
          findOneAndUpdate: vi
            .fn()
            .mockResolvedValue({
              userId: new Types.ObjectId(userId),
              rating: 1240,
            }),
        } as never,
        { aggregate: vi.fn().mockResolvedValue([{ total: change }]) } as never,
      );
      const result = await service.getMyArenaOverview(userId);
      expect(result).toEqual({
        userId,
        rating: 1240,
        todayRatingChange: change,
        leaderboard: { position: 2, topPercent: 20, totalPlayers: 10 },
        ranked: {
          matches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          currentWinStreak: 0,
          bestWinStreak: 0,
        },
      });
      expect(read.getRankedStatistics).toHaveBeenCalledWith(userId);
    },
  );
  it('limits signed Elo history to this user and today, with zero for no matches', async () => {
    const aggregate = vi.fn().mockResolvedValue([]);
    const service = new ArenaService(
      {
        getRankedStatistics: vi.fn().mockResolvedValue({ matches: 0 }),
        getLeaderboard: vi
          .fn()
          .mockResolvedValue({ me: null, totalPlayers: 0 }),
      } as never,
      {
        findOneAndUpdate: vi
          .fn()
          .mockResolvedValue({
            userId: new Types.ObjectId(userId),
            rating: 1000,
          }),
      } as never,
      { aggregate } as never,
    );
    expect(await service.getMyArenaOverview(userId)).toMatchObject({
      rating: 1000,
      todayRatingChange: 0,
      leaderboard: { position: null },
    });
    const { start, end } = arenaTodayRange();
    expect(aggregate).toHaveBeenCalledWith([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          createdAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: null, total: { $sum: '$change' } } },
    ]);
  });
});

describe('Arena calendar periods in Vietnam', () => {
  it('changes the Elo day at Vietnamese midnight instead of the host timezone', () => {
    expect(
      arenaTodayRange(new Date('2026-10-14T16:59:59Z')).start.toISOString(),
    ).toBe('2026-10-13T17:00:00.000Z');
    const range = arenaTodayRange(new Date('2026-10-14T17:00:00Z'));
    expect(range.start.toISOString()).toBe('2026-10-14T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-10-15T17:00:00.000Z');
  });
  it('starts the week on Monday at local midnight, including UTC Sunday', () => {
    expect(
      arenaPeriodStart('week', new Date('2026-10-11T18:00:00Z'))?.toISOString(),
    ).toBe('2026-10-11T17:00:00.000Z');
    expect(
      arenaPeriodStart('week', new Date('2026-10-11T16:00:00Z'))?.toISOString(),
    ).toBe('2026-10-04T17:00:00.000Z');
  });
  it('starts the month at local midnight and leaves all-time unrestricted', () => {
    expect(
      arenaPeriodStart(
        'month',
        new Date('2026-09-30T18:00:00Z'),
      )?.toISOString(),
    ).toBe('2026-09-30T17:00:00.000Z');
    expect(arenaPeriodStart('all')).toBeUndefined();
  });
});
