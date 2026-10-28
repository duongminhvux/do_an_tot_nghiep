import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import {createConnection} from '../../../postgres/connection.js';
import {SqlRecords} from '../../../postgres/records.js';
import {sql,rows} from '../../../postgres/sql.js';
import {randomUUID} from 'node:crypto';
import { FriendRoom } from '../rows/friend-room.row.js';
import { ArenaFriendMode } from '../rows/arena-match.row.js';
import { ArenaMatchPlayer } from '../rows/arena-match-player.row.js';

describe.runIf(Boolean(process.env.ARENA_TEST_DATABASE_URL))('Arena room PostgreSQL persistence', () => {
  const pool = new Pool({ connectionString: process.env.ARENA_TEST_DATABASE_URL });
  const ids: string[] = [];
  const playerIds: string[] = [];
  it('scores a question exactly once with a JSONB membership filter and a conditional SQL update', async () => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const players = new SqlRecords<any>(createConnection(pool),'arenamatchplayers');
    const player = await players.insert({ matchId: randomUUID(), userId: randomUUID() });
    playerIds.push(String(player._id));
    const questionId = randomUUID();
    const score=()=>players.patch(sql`id=${player._id}::uuid AND NOT (scored_question_ids ? ${questionId})`,{},{score:sql`score+100`,scoredQuestionIds:sql`scored_question_ids||${JSON.stringify([questionId])}::jsonb`});
    const updated = await Promise.all([score(), score()]);
    expect(updated.reduce((sum, result) => sum+Number(!!result), 0)).toBe(1);
    const saved = await players.one(sql`id=${player._id}::uuid`);
    expect(saved?.score).toBe(100);
    expect(saved?.scoredQuestionIds.map(String)).toEqual([String(questionId)]);
  });
  it('persists group readiness, disconnect state and the readiness reset after a match', async () => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const rooms = new SqlRecords<any>(createConnection(pool),'friendrooms');
    const guests = [randomUUID(), randomUUID()];
    const room = await rooms.insert({
      code: randomUUID().slice(0,8), hostId: randomUUID(), maxPlayers: 8,
      mode: ArenaFriendMode.CLASSIC, settings: { questionCount: 10, timePerQuestion: 15 },
      members: guests.map(userId => ({ userId, isReady: false, disconnectedAt: null })),
    });
    ids.push(String(room._id));
    const disconnectedAt = new Date();
    await rooms.patch(sql`id=${room._id}::uuid`,{},{members:sql`(SELECT jsonb_agg(CASE WHEN m->>'userId'=${guests[1]} THEN m||jsonb_build_object('isReady',true,'disconnectedAt',${disconnectedAt}::timestamptz) ELSE m END ORDER BY ordinal) FROM jsonb_array_elements(members) WITH ORDINALITY entry(m,ordinal))`});
    let saved = await rooms.one(sql`id=${room._id}::uuid`);
    expect(saved?.members[0].isReady).toBe(false);
    expect(saved?.members[0].disconnectedAt).toBeNull();
    expect(saved?.members[1].isReady).toBe(true);
    expect(saved?.members[1].disconnectedAt?.getTime()).toBe(disconnectedAt.getTime());
    await rooms.patch(sql`id=${room._id}::uuid`,{},{members:sql`(SELECT jsonb_agg(m||jsonb_build_object('isReady',false) ORDER BY ordinal) FROM jsonb_array_elements(members) WITH ORDINALITY entry(m,ordinal))`});
    saved = await rooms.one(sql`id=${room._id}::uuid`);
    expect(saved?.members.map((m:any) => m.isReady)).toEqual([false, false]);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    await pool.query('DELETE FROM public.arenamatchplayers WHERE id=ANY($1::uuid[])', [playerIds]);
    await pool.query('DELETE FROM public.friendrooms WHERE id=ANY($1::uuid[])', [ids]);
    await pool.end();
  });
  it('restores disconnect timestamps from JSONB so reconnect and lifecycle checks can run', async () => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const rooms = new SqlRecords<any>(createConnection(pool),'friendrooms');
    const disconnectedAt = new Date('2026-10-25T10:00:00Z');
    const room = await rooms.insert({
      code: randomUUID().slice(0, 8), hostId: randomUUID(),
      mode: ArenaFriendMode.CLASSIC, settings: { questionCount: 10, timePerQuestion: 15 },
      maxPlayers: 8, hostDisconnectedAt: disconnectedAt,
      members: [{ userId: randomUUID(), isReady: false, disconnectedAt }],
      runtimePolicy: { reconnectGrace: 20, idleTimeout: 1800 },
    });
    ids.push(String(room._id));
    const restored = await rooms.one(sql`id=${room._id}::uuid`);
    expect(restored?.hostDisconnectedAt?.getTime()).toBe(disconnectedAt.getTime());
    expect(restored?.members[0].disconnectedAt?.toISOString()).toBe(disconnectedAt.toISOString());
    expect(restored?.createdAt).toBeInstanceOf(Date);
  });
  it('persists initial defaults so conditional guest joins can match an empty room', async () => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const rooms = new SqlRecords<any>(createConnection(pool),'friendrooms');
    const room = await rooms.insert({
      code: randomUUID().slice(0, 8), hostId: randomUUID(),
      mode: ArenaFriendMode.CLASSIC, settings: { questionCount: 10, timePerQuestion: 15 },
      runtimePolicy: { reconnectGrace: 20, idleTimeout: 1800 },
    });
    ids.push(String(room._id));
    const raw = (await pool.query('SELECT status,revision,max_players,guest_ready,match_count FROM public.friendrooms WHERE id=$1', [String(room._id)])).rows[0];
    expect(raw).toEqual({ status: 'WAITING', revision: 0, max_players: 2, guest_ready: false, match_count: 0 });
    const guestId = randomUUID();
    const joined = await rooms.patch(sql`("id" = ${room._id}) AND ("status" = ${'WAITING'}) AND ("guest_id" IS NULL)`,{ guestId },{"revision":sql`COALESCE("revision",0)+${1}`});
    expect(String(joined?.guestId)).toBe(String(guestId));
    expect(joined?.revision).toBe(1);
  });
  it.each([2, 8])('stores the runtime policy for a %i-player room as an object', async (maxPlayers) => {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    const rooms = new SqlRecords<any>(createConnection(pool),'friendrooms');
    const policy = { reconnectGrace: 20, idleTimeout: 1800 };
    const room = await rooms.insert({
      code: randomUUID().slice(0, 8), hostId: randomUUID(),
      mode: ArenaFriendMode.CLASSIC, settings: { questionCount: 10, timePerQuestion: 15 },
      maxPlayers, members: [], runtimePolicy: policy,
    });
    ids.push(String(room._id));
    expect(room.runtimePolicy).toEqual(policy);
    expect((await rooms.one(sql`id=${room._id}::uuid`))?.runtimePolicy).toEqual(policy);
    const stored = await pool.query('SELECT jsonb_typeof(runtime_policy) AS type FROM public.friendrooms WHERE id=$1', [String(room._id)]);
    expect(stored.rows[0].type).toBe('object');
  });
});
