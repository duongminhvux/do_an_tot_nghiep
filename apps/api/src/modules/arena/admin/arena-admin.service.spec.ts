import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ArenaAdminService } from './arena-admin.service.js';
import { ArenaAdminQuery, ArenaDashboardQuery, ArenaRoomQuery } from './arena-admin.dto.js';

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
