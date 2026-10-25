import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PgId, runAggregation } from '../../../postgres/compat.js';
import { ArenaAdminService } from './arena-admin.service.js';
import { ArenaAdminQuery, ArenaDashboardQuery, ArenaRoomQuery, ArenaPlayerQuery } from './arena-admin.dto.js';

vi.mock('../gateways/arena.gateway.js', () => ({ ArenaGateway: class {} }));
vi.mock('../friendly/arena-friend-room.service.js', () => ({ ArenaFriendRoomService: class {} }));
vi.mock('../presence/arena-presence.service.js', () => ({ ArenaPresenceService: class {} }));

const matchId = '00000000-0000-4000-8000-000000000001';
function model(rows: unknown[]) {
  const query = {
    sort: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
  return {
    find: vi.fn(() => query),
    findById: vi.fn(() => ({ lean: async () => rows[0] })),
    countDocuments: vi.fn().mockResolvedValue(rows.length),
    aggregate: vi.fn().mockResolvedValue([]),
  };
}
function fixture(match: Record<string, unknown>, room: Record<string, unknown> = {}) {
  return new ArenaAdminService(
    model([{ _id: matchId, type: 'RANK', ...match }]) as never,
    model([]) as never,
    model([]) as never,
    model([]) as never,
    model([]) as never,
    model([]) as never,
    model([room]) as never,
    model([]) as never,
    { overview: async () => ({ onlineCount: 0 }) } as never,
    { participants: () => [] } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('Arena admin timestamps', () => {
  it.each([
    ['2026-10-24T10:00:00.000Z', '2026-10-24T10:01:30.000Z', 90],
    [new Date('2026-10-24T10:00:00Z'), new Date('2026-10-24T10:01:30Z'), 90],
    [new Date('2026-10-24T10:00:00Z'), '2026-10-24T10:01:30.600Z', 91],
    ['2026-10-24T10:01:30Z', '2026-10-24T10:00:00Z', 0],
    [null, '2026-10-24T10:01:30Z', null],
    ['2026-10-24T10:00:00Z', undefined, null],
    ['invalid', '2026-10-24T10:01:30Z', null],
    ['2026-10-24T10:00:00Z', 'invalid', null],
  ])('returns dashboard duration for %s / %s', async (startedAt, finishedAt, duration) => {
    const service = fixture({ startedAt, finishedAt });
    const result = await service.dashboard(new ArenaDashboardQuery());
    expect(result.recent[0].duration).toBe(duration);
    expect(result.days).toBe(7);
  });

  it('supports the same ISO timestamps in match list and detail', async () => {
    const service = fixture({ startedAt: '2026-10-24T10:00:00Z', finishedAt: '2026-10-24T10:01:30Z' });
    expect((await service.matchList(new ArenaAdminQuery())).items[0].duration).toBe(90);
    expect((await service.matchDetail(matchId)).duration).toBe(90);
  });

  it.each([
    [new Date(Date.now() - 3600000).toISOString(), 'WAITING', true],
    [new Date(Date.now() - 3600000), 'WAITING', true],
    [new Date(Date.now() + 3600000).toISOString(), 'WAITING', false],
    ['invalid', 'WAITING', false],
    [null, 'WAITING', false],
    [new Date(Date.now() - 3600000).toISOString(), 'CLOSED', false],
  ])('handles room timestamp %s with status %s', async (updatedAt, status, stale) => {
    const service = fixture({}, { updatedAt, status });
    expect((await service.roomList(new ArenaRoomQuery())).items[0].stale).toBe(stale);
  });
});

describe('Arena admin player identities', () => {
  afterEach(() => vi.unstubAllEnvs());
  function playersFixture() {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const userId = '00000000-0000-4000-8000-000000000002';
    const missingId = '00000000-0000-4000-8000-000000000003';
    const profile = (id: string, rating: number) => ({
      _id: new PgId(id), userId: new PgId(id), rating,
      rankedMatches: 4, rankedWins: 3, rankedLosses: 1, rankedDraws: 0,
      currentWinStreak: 2, bestWinStreak: 3, updatedAt: new Date(),
    });
    const publicUser = {
      id: userId, username: 'Arena Player', avatar_url: '/avatar.png',
      is_banned: false, is_deleted: false,
      payload: { username: 'Arena Player', password: 'must-not-leak', phone: 'must-not-leak' },
    };
    const pool = { query: vi.fn(async (sql: string) => ({
      rows: sql.includes('identity_profiles') ? [publicUser] : [],
    })) };
    const service = fixture({});
    Object.assign(service as unknown as Record<string, unknown>, {
      users: { collection: { name: 'users' } },
      participants: { collection: { name: 'arenamatchplayers' } },
      profiles: { aggregate: (pipeline: unknown[]) => runAggregation(pipeline,
        [profile(userId, 1500), profile(missingId, 1000)], pool as never) },
    });
    return { service, userId };
  }
  it('returns a nested display user rather than literal dotted fields', async () => {
    const { service, userId } = playersFixture();
    const result = await service.playerList(new ArenaPlayerQuery());
    const row = JSON.parse(JSON.stringify(result.items[0]));
    expect(row.userId).toBe(userId);
    expect(row.user).toEqual({ _id: userId, username: 'Arena Player', avatarUrl: '/avatar.png', isBanned: false, isDeleted: false });
    expect(Object.hasOwn(row, 'user.username')).toBe(false);
    expect(JSON.stringify(row)).not.toContain('must-not-leak');
    expect(result.items[1].user).toBeNull();
  });
  it('keeps searching by player name working before pagination', async () => {
    const { service } = playersFixture();
    const result = await service.playerList(Object.assign(new ArenaPlayerQuery(), { search: 'arena player', limit: 1 }));
    expect(result.total).toBe(1);
    expect(result.items[0].user.username).toBe('Arena Player');
  });
  it('keeps the user object on subsequent pages without a matching profile', async () => {
    const { service } = playersFixture();
    const result = await service.playerList(Object.assign(new ArenaPlayerQuery(), { page: 2, limit: 1 }));
    expect(result.total).toBe(2);
    expect(result.items[0].user).toBeNull();
  });
});
