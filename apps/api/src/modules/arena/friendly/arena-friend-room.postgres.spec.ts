import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makePgModel, PgId } from '../../../postgres/compat.js';
import { FriendRoom } from '../schemas/friend-room.schema.js';
import { ArenaFriendMode } from '../schemas/arena-match.schema.js';

describe.runIf(Boolean(process.env.ARENA_TEST_DATABASE_URL))('Arena room PostgreSQL persistence', () => {
  const pool = new Pool({ connectionString: process.env.ARENA_TEST_DATABASE_URL });
  const ids: string[] = [];
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    await pool.query('DELETE FROM public.friendrooms WHERE id=ANY($1::uuid[])', [ids]);
    await pool.end();
  });
  it('restores disconnect timestamps from JSONB so reconnect and lifecycle checks can run', async () => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const rooms = makePgModel<FriendRoom>(FriendRoom.name, pool);
    const disconnectedAt = new Date('2026-10-25T10:00:00Z');
    const room = await rooms.create({
      code: randomUUID().slice(0, 8), hostId: new PgId(randomUUID()),
      mode: ArenaFriendMode.CLASSIC, settings: { questionCount: 10, timePerQuestion: 15 },
      maxPlayers: 8, hostDisconnectedAt: disconnectedAt,
      members: [{ userId: new PgId(randomUUID()), isReady: false, disconnectedAt }],
      runtimePolicy: { reconnectGrace: 20, idleTimeout: 1800 },
    });
    ids.push(String(room._id));
    const restored = await rooms.findById(room._id).lean();
    expect(restored?.hostDisconnectedAt?.getTime()).toBe(disconnectedAt.getTime());
    expect(restored?.members[0].disconnectedAt?.toISOString()).toBe(disconnectedAt.toISOString());
    expect(restored?.createdAt).toBeInstanceOf(Date);
  });
  it('persists initial defaults so conditional guest joins can match an empty room', async () => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const rooms = makePgModel<FriendRoom>(FriendRoom.name, pool);
    const room = await rooms.create({
      code: randomUUID().slice(0, 8), hostId: new PgId(randomUUID()),
      mode: ArenaFriendMode.CLASSIC, settings: { questionCount: 10, timePerQuestion: 15 },
      runtimePolicy: { reconnectGrace: 20, idleTimeout: 1800 },
    });
    ids.push(String(room._id));
    const raw = (await pool.query('SELECT status,revision,max_players,guest_ready,match_count FROM public.friendrooms WHERE id=$1', [String(room._id)])).rows[0];
    expect(raw).toEqual({ status: 'WAITING', revision: 0, max_players: 2, guest_ready: false, match_count: 0 });
    const guestId = new PgId(randomUUID());
    const joined = await rooms.findOneAndUpdate({ _id: room._id, status: 'WAITING', guestId: null }, { $set: { guestId }, $inc: { revision: 1 } }, { returnDocument: 'after' });
    expect(String(joined?.guestId)).toBe(String(guestId));
    expect(joined?.revision).toBe(1);
  });
  it.each([2, 8])('stores the runtime policy for a %i-player room as an object', async (maxPlayers) => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const rooms = makePgModel<FriendRoom>(FriendRoom.name, pool);
    const policy = { reconnectGrace: 20, idleTimeout: 1800 };
    const room = await rooms.create({
      code: randomUUID().slice(0, 8), hostId: new PgId(randomUUID()),
      mode: ArenaFriendMode.CLASSIC, settings: { questionCount: 10, timePerQuestion: 15 },
      maxPlayers, members: [], runtimePolicy: policy,
    });
    ids.push(String(room._id));
    expect(room.runtimePolicy).toEqual(policy);
    expect((await rooms.findById(room._id).lean())?.runtimePolicy).toEqual(policy);
    const stored = await pool.query('SELECT jsonb_typeof(runtime_policy) AS type FROM public.friendrooms WHERE id=$1', [String(room._id)]);
    expect(stored.rows[0].type).toBe('object');
  });
});
