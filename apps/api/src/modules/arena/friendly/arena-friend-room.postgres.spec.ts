import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makePgModel, PgId } from '../../../postgres/compat.js';
import { FriendRoom } from '../schemas/friend-room.schema.js';
import { ArenaFriendMode } from '../schemas/arena-match.schema.js';
import { ArenaMatchPlayer } from '../schemas/arena-match-player.schema.js';

describe.runIf(Boolean(process.env.ARENA_TEST_DATABASE_URL))('Arena room PostgreSQL persistence', () => {
  const pool = new Pool({ connectionString: process.env.ARENA_TEST_DATABASE_URL });
  const ids: string[] = [];
  const playerIds: string[] = [];
  it('scores a question exactly once with a JSONB membership filter and an update pipeline', async () => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const players = makePgModel<ArenaMatchPlayer>(ArenaMatchPlayer.name, pool);
    const player = await players.create({ matchId: new PgId(), userId: new PgId() });
    playerIds.push(String(player._id));
    const questionId = new PgId();
    const score = () => players.updateOne({ _id: player._id, scoredQuestionIds: { $ne: questionId } }, [
      { $set: { score: { $add: ['$score', 100] }, scoredQuestionIds: { $concatArrays: ['$scoredQuestionIds', [questionId]] } } },
    ]);
    const updated = await Promise.all([score(), score()]);
    expect(updated.reduce((sum, result) => sum+result.modifiedCount, 0)).toBe(1);
    const saved = await players.findById(player._id);
    expect(saved?.score).toBe(100);
    expect(saved?.scoredQuestionIds.map(String)).toEqual([String(questionId)]);
  });
  it('persists group readiness, disconnect state and the readiness reset after a match', async () => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const rooms = makePgModel<FriendRoom>(FriendRoom.name, pool);
    const guests = [new PgId(), new PgId()];
    const room = await rooms.create({
      code: randomUUID().slice(0,8), hostId: new PgId(), maxPlayers: 8,
      mode: ArenaFriendMode.CLASSIC, settings: { questionCount: 10, timePerQuestion: 15 },
      members: guests.map(userId => ({ userId, isReady: false, disconnectedAt: null })),
    });
    ids.push(String(room._id));
    const disconnectedAt = new Date();
    await rooms.updateOne({ _id: room._id, 'members.userId': guests[1] }, { $set: { 'members.$.isReady': true, 'members.$.disconnectedAt': disconnectedAt } });
    let saved = await rooms.findById(room._id);
    expect(saved?.members[0].isReady).toBe(false);
    expect(saved?.members[0].disconnectedAt).toBeNull();
    expect(saved?.members[1].isReady).toBe(true);
    expect(saved?.members[1].disconnectedAt?.getTime()).toBe(disconnectedAt.getTime());
    await rooms.updateOne({ _id: room._id }, { $set: { 'members.$[].isReady': false } });
    saved = await rooms.findById(room._id);
    expect(saved?.members.map(m => m.isReady)).toEqual([false, false]);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    await pool.query('DELETE FROM public.arenamatchplayers WHERE id=ANY($1::uuid[])', [playerIds]);
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
