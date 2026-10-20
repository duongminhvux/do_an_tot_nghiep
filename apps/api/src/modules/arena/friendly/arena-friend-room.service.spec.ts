import { Types } from 'mongoose';
import {
  ArenaFriendRoomService,
  validateFriendSettings,
} from './arena-friend-room.service.js';
import { ArenaFriendMode } from '../schemas/arena-match.schema.js';

vi.mock('../schemas/friend-room.schema.js', () => ({
  FriendRoom: class {},
  FriendRoomStatus: {
    WAITING: 'WAITING',
    IN_MATCH: 'IN_MATCH',
    CLOSED: 'CLOSED',
  },
}));
vi.mock('../schemas/arena-match.schema.js', () => ({
  ArenaMatch: class {},
  ArenaFriendMode: {
    CLASSIC: 'CLASSIC',
    WORD_CHAIN: 'WORD_CHAIN',
    WORD_GUESS: 'WORD_GUESS',
  },
  ArenaMatchType: { FRIEND: 'FRIEND', ROOM: 'ROOM' },
  ArenaQuestionMode: { MEANING_TO_WORD: 'MEANING_TO_WORD' },
  ArenaMatchFinishReason: { PLAYER_LEFT: 'PLAYER_LEFT' },
  ArenaMatchStatus: {
    WAITING: 'WAITING',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    FINISHED: 'FINISHED',
    CANCELLED: 'CANCELLED',
  },
}));
vi.mock('../../vocabulary/words/word.schema.js', () => ({ Word: class {} }));
vi.mock('../../users/schema/user.schema.js', () => ({ User: class {} }));
vi.mock('../matches/arena-match.service.js', () => ({
  ArenaMatchService: class {},
}));
vi.mock('../presence/arena-presence.service.js', () => ({
  ArenaPresenceService: class {},
}));
vi.mock('../question/arena-question.service.js', () => ({
  ArenaQuestionService: class {},
}));
vi.mock('../arena.service.js', () => ({ ArenaService: class {} }));
vi.mock('../../../common/redis/redis.service.js', () => ({
  RedisService: class {},
}));

type Row = Record<string, any>;
function fixture() {
  const host = String(new Types.ObjectId()),
    guest = String(new Types.ObjectId()),
    third = String(new Types.ObjectId());
  const data: Row[] = [];
  const matchesData: Row[] = [];
  const clone = (row?: Row) =>
    row
      ? {
          ...row,
          members: (row.members ?? []).map((m: Row) => ({ ...m })),
          settings: row.settings ? { ...row.settings } : undefined,
        }
      : null;
  const equal = (a: unknown, b: unknown) =>
    (a == null && b == null) || String(a) === String(b);
  const fits = (row: Row, filter: Row): boolean =>
    Object.entries(filter).every(([key, value]) => {
      if (key === 'members.userId')
        return (row.members ?? []).some((m: Row) => equal(m.userId, value));
      if (key === '$or') return value.some((f: Row) => fits(row, f));
      if (value && typeof value === 'object' && '$in' in value)
        return value.$in.some((v: unknown) => equal(row[key], v));
      return equal(row[key], value);
    });
  const apply = (row: Row, update: Row, filter: Row) => {
    for (const [key, value] of Object.entries(update.$set ?? {})) {
      if (key.startsWith('members.$.')) {
        const member = row.members.find((m: Row) =>
          equal(m.userId, filter['members.userId']),
        );
        if (member) member[key.split('.').at(-1)!] = value;
      } else row[key] = value;
    }
    if (update.$pull?.members)
      row.members = row.members.filter(
        (m: Row) => !equal(m.userId, update.$pull.members.userId),
      );
    for (const [key, value] of Object.entries(update.$inc || {}))
      row[key] = (row[key] || 0) + Number(value);
  };
  const model = (rows: Row[]) => ({
    findById: vi.fn(async (id: unknown) =>
      clone(rows.find((r) => equal(r._id, id))),
    ),
    findOne: vi.fn(async (filter: Row) =>
      clone(rows.find((r) => fits(r, filter))),
    ),
    find: vi.fn(async (filter: Row) =>
      rows.filter((r) => fits(r, filter)).map((r) => clone(r)),
    ),
    create: vi.fn(async (values: Row) => {
      const row = {
        _id: new Types.ObjectId(),
        guestId: null,
        status: 'WAITING',
        guestReady: false,
        currentMatchId: null,
        matchCount: 0,
        revision: 0,
        hostDisconnectedAt: null,
        guestDisconnectedAt: null,
        ...values,
      };
      rows.push(row);
      return clone(row);
    }),
    findOneAndUpdate: vi.fn(async (filter: Row, update: Row) => {
      const row = rows.find((r) => fits(r, filter));
      if (!row) return null;
      apply(row, update, filter);
      return clone(row);
    }),
    updateOne: vi.fn(async (filter: Row, update: Row) => {
      const row = rows.find((r) => fits(r, filter));
      if (!row) return { modifiedCount: 0 };
      apply(row, update, filter);
      return { modifiedCount: 1 };
    }),
    findOneAndDelete: vi.fn(async (filter: Row) => {
      const i = rows.findIndex((r) => fits(r, filter));
      return i >= 0 ? rows.splice(i, 1)[0] : null;
    }),
  });
  const rooms = model(data),
    matches = model(matchesData);
  const users = {
    find: vi.fn((filter: { _id: { $in: Types.ObjectId[] } }) => ({
      select: async () =>
        filter._id.$in.map((id) => ({ _id: id, username: String(id) })),
    })),
  };
  const matchService = {
    findActiveMatchForUser: vi.fn(async () => null),
    getOpponentUserId: vi.fn(async () => guest),
    finishMatch: vi.fn(),
    createMatch: vi.fn(async (_host: string, _guest: string, options: Row) => {
      const match = {
        _id: new Types.ObjectId(),
        status: 'COUNTDOWN',
        ...options,
      };
      matchesData.push(match);
      return { match };
    }),
  };
  const presence = { isOnline: vi.fn(async () => true) };
  const questions = { createRankedQuestions: vi.fn() };
  const arena = { getOrCreateProfile: vi.fn() };
  const locks = new Set<string>();
  const redis = {
    set: vi.fn(async (key: string) => {
      if (locks.has(key)) return null;
      locks.add(key);
      return 'OK';
    }),
    eval: vi.fn(async (_script: string, args: { keys: string[] }) => {
      locks.delete(args.keys[0]!);
    }),
  };
  const deps = [
    rooms,
    matches,
    users,
    matchService,
    presence,
    questions,
    arena,
    { getClient: () => redis },
    { aggregate: vi.fn(async () => [{ word: 'APPLE' }]) },
  ] as unknown as ConstructorParameters<typeof ArenaFriendRoomService>;
  const service = new ArenaFriendRoomService(...deps);
  const create = async () => service.create(host);
  const pair = async () => {
    const room = await create();
    await service.join(guest, room.code);
    await service.ready(room.roomId, guest, true);
    return room;
  };
  return {
    service,
    host,
    guest,
    third,
    data,
    matchesData,
    rooms,
    matches,
    matchService,
    presence,
    questions,
    create,
    pair,
  };
}

describe('Friendly settings validation', () => {
  it('keeps Classic and Word Chain settings separate', () => {
    expect(validateFriendSettings(ArenaFriendMode.CLASSIC)).toEqual({
      questionCount: 10,
      timePerQuestion: 15,
    });
    expect(validateFriendSettings(ArenaFriendMode.WORD_CHAIN)).toEqual({
      turnTime: 20,
    });
  });
  it.each([
    { questionCount: 4 },
    { questionCount: 31 },
    { questionCount: 5.5 },
    { timePerQuestion: 11 },
    { timePerQuestion: '15' },
    { turnTime: 20 },
  ])('rejects invalid Classic settings %j', (settings) => {
    expect(() =>
      validateFriendSettings(ArenaFriendMode.CLASSIC, settings as never),
    ).toThrow('INVALID_ROOM_SETTINGS');
  });
  it.each([{ questionCount: 10 }, { timePerQuestion: 20 }, { turnTime: 0 }])(
    'rejects invalid Word Chain settings %j',
    (settings) => {
      expect(() =>
        validateFriendSettings(ArenaFriendMode.WORD_CHAIN, settings),
      ).toThrow('INVALID_ROOM_SETTINGS');
    },
  );
});

describe('Friendly room lifecycle', () => {
  it('creates a unique six-character lobby without a match', async () => {
    const f = fixture();
    const room = await f.create();
    expect(room.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(room).toMatchObject({
      hostId: f.host,
      guestId: null,
      guestReady: false,
      status: 'WAITING',
      matchCount: 0,
    });
    expect(f.matchService.createMatch).not.toHaveBeenCalled();
    const other = await f.service.create(f.third);
    expect(other.code).not.toBe(room.code);
  });
  it('rejects creation while the player is already in a room or a match', async () => {
    const f = fixture();
    await f.create();
    await expect(f.create()).rejects.toThrow('ALREADY_IN_ROOM');
    f.matchService.findActiveMatchForUser.mockResolvedValueOnce({} as never);
    await expect(f.service.create(f.third)).rejects.toThrow('ALREADY_IN_MATCH');
  });
  it('allows exactly one of two concurrent guests to claim a room', async () => {
    const f = fixture();
    const room = await f.create();
    const results = await Promise.allSettled([
      f.service.join(f.guest, room.code.toLowerCase()),
      f.service.join(f.third, room.code),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.data[0]!.guestId).toBeTruthy();
    await expect(f.service.join(f.host, room.code)).rejects.toThrow(
      'ALREADY_IN_ROOM',
    );
  });
  it('prevents one guest from joining two rooms concurrently', async () => {
    const f = fixture();
    const first = await f.create();
    const second = await f.service.create(f.third);
    const results = await Promise.allSettled([
      f.service.join(f.guest, first.code),
      f.service.join(f.guest, second.code),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('requires host settings permission and guest ready permission', async () => {
    const f = fixture();
    const room = await f.pair();
    await expect(
      f.service.update(room.roomId, f.guest, ArenaFriendMode.CLASSIC, {}),
    ).rejects.toThrow('NOT_ROOM_HOST');
    await expect(f.service.ready(room.roomId, f.host, true)).rejects.toThrow(
      'NOT_ROOM_GUEST',
    );
    const updated = await f.service.update(
      room.roomId,
      f.host,
      ArenaFriendMode.CLASSIC,
      { questionCount: 25, timePerQuestion: 30 },
    );
    expect(updated.guestReady).toBe(false);
    expect(updated.settings).toEqual({
      questionCount: 25,
      timePerQuestion: 30,
    });
  });
  it('does not start without a guest or ready confirmation', async () => {
    const f = fixture();
    const room = await f.create();
    await expect(f.service.start(room.roomId, f.host)).rejects.toThrow(
      'GUEST_NOT_READY',
    );
    await f.service.join(f.guest, room.code);
    await expect(f.service.start(room.roomId, f.host)).rejects.toThrow(
      'GUEST_NOT_READY',
    );
    await expect(f.service.start(room.roomId, f.guest)).rejects.toThrow(
      'NOT_ROOM_HOST',
    );
  });
  it('creates only one match for concurrent Start requests and snapshots settings', async () => {
    const f = fixture();
    const room = await f.pair();
    await f.service.update(room.roomId, f.host, ArenaFriendMode.CLASSIC, {
      questionCount: 15,
      timePerQuestion: 30,
    });
    await f.service.ready(room.roomId, f.guest, true);
    const results = await Promise.allSettled([
      f.service.start(room.roomId, f.host),
      f.service.start(room.roomId, f.host),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.matchService.createMatch).toHaveBeenCalledOnce();
    expect(f.matchesData[0]).toMatchObject({
      type: 'FRIEND',
      questionMode: 'MEANING_TO_WORD',
      questionCount: 15,
      secondsPerQuestion: 30,
      settingsSnapshot: { questionCount: 15, timePerQuestion: 30 },
      roomCodeSnapshot: room.code,
      status: 'PLAYING',
    });
    expect(f.questions.createRankedQuestions).toHaveBeenCalledWith(
      String(f.matchesData[0]!._id),
      15,
    );
    expect(f.data[0]).toMatchObject({ status: 'IN_MATCH', matchCount: 1 });
  });
  it('starts Word Chain with the host and the configured turn duration, without questions', async () => {
    const f = fixture();
    const room = await f.pair();
    await f.service.update(room.roomId, f.host, ArenaFriendMode.WORD_CHAIN, {
      turnTime: 30,
    });
    await f.service.ready(room.roomId, f.guest, true);
    await f.service.start(room.roomId, f.host);
    const match = f.matchesData[0]!;
    expect(String(match.currentTurnUserId)).toBe(f.host);
    expect(match.turnDeadline.getTime() - match.turnStartedAt.getTime()).toBe(
      30000,
    );
    expect(match.questionMode).toBeNull();
    expect(match.settingsSnapshot).toEqual({ turnTime: 30 });
    expect(f.questions.createRankedQuestions).not.toHaveBeenCalled();
  });
  it('recovers to an unready lobby when question generation fails', async () => {
    const f = fixture();
    const room = await f.pair();
    f.questions.createRankedQuestions.mockRejectedValueOnce(
      new Error('No vocabulary'),
    );
    await expect(f.service.start(room.roomId, f.host)).rejects.toThrow(
      'No vocabulary',
    );
    expect(f.data[0]).toMatchObject({
      status: 'WAITING',
      currentMatchId: null,
      guestReady: false,
    });
    expect(f.matchesData[0]!.status).toBe('CANCELLED');
  });
  it('deletes the room and kicks the guest when the host leaves before any match', async () => {
    const f = fixture();
    const room = await f.pair();
    const event = await f.service.leave(room.roomId, f.host);
    expect(f.data).toHaveLength(0);
    expect(event).toMatchObject({
      users: [f.host, f.guest],
      event: 'friend-room:closed',
      data: { roomId: room.roomId, code: room.code, hostId: f.host, reason: 'HOST_LEFT' },
    });
    await expect(f.service.snapshot(room.roomId, f.guest)).rejects.toThrow(
      'ROOM_NOT_FOUND',
    );
    expect(f.matchesData).toHaveLength(0);
  });
  it('retains host ownership after a guest leaves and permits another guest', async () => {
    const f = fixture();
    const room = await f.pair();
    await f.service.leave(room.roomId, f.guest);
    expect(f.data[0]).toMatchObject({
      hostId: new Types.ObjectId(f.host),
      guestId: null,
      guestReady: false,
    });
    await f.service.join(f.third, room.code);
    expect(String(f.data[0]!.guestId)).toBe(f.third);
    await expect(f.service.snapshot(room.roomId, f.guest)).rejects.toThrow(
      'NOT_ROOM_GUEST',
    );
  });
  it('deleting a played room preserves match history', async () => {
    const f = fixture();
    const room = await f.pair();
    await f.service.start(room.roomId, f.host);
    f.matchesData[0]!.status = 'FINISHED';
    f.data[0]!.status = 'WAITING';
    f.data[0]!.currentMatchId = null;
    const snapshot = { ...f.matchesData[0] };
    await f.service.leave(room.roomId, f.host);
    expect(f.matchesData[0]).toEqual(snapshot);
    expect(f.data).toHaveLength(0);
  });
  it('does not create a match when both users return to the room', async () => {
    const f = fixture();
    const room = await f.pair();
    await Promise.all([
      f.service.snapshot(room.roomId, f.host),
      f.service.snapshot(room.roomId, f.guest),
    ]);
    expect(f.matchService.createMatch).not.toHaveBeenCalled();
  });
  it('keeps the old match snapshot when a new match uses different settings', async () => {
    const f = fixture();
    const room = await f.pair();
    await f.service.start(room.roomId, f.host);
    f.matchesData[0]!.status = 'FINISHED';
    Object.assign(f.data[0]!, {
      status: 'WAITING',
      currentMatchId: null,
      guestReady: false,
    });
    await f.service.update(room.roomId, f.host, ArenaFriendMode.CLASSIC, {
      questionCount: 20,
      timePerQuestion: 30,
    });
    await f.service.ready(room.roomId, f.guest, true);
    await f.service.start(room.roomId, f.host);
    expect(f.matchesData).toHaveLength(2);
    expect(f.matchesData[0]!.settingsSnapshot).toEqual({
      questionCount: 10,
      timePerQuestion: 15,
    });
    expect(f.matchesData[1]!.settingsSnapshot).toEqual({
      questionCount: 20,
      timePerQuestion: 30,
    });
  });
  it('keeps a temporarily disconnected room and restores the same membership', async () => {
    const f = fixture();
    const room = await f.pair();
    await f.service.connection(f.host, false);
    await f.service.tick();
    expect(f.data).toHaveLength(1);
    const snapshot = await f.service.connection(f.host, true);
    expect(snapshot?.roomId).toBe(room.roomId);
    expect(f.data[0]!.hostDisconnectedAt).toBeNull();
  });
  it('rejects a host reconnect after grace even before the cleanup tick', async () => {
    const f = fixture();
    await f.pair();
    f.data[0]!.hostDisconnectedAt = new Date(Date.now() - 21000);
    const expired = await f.service.expireBeforeReconnect(f.host);
    expect(expired?.event).toBe('friend-room:closed');
    expect(f.data).toHaveLength(0);
  });
  it('cancels a start if the host closes the room during question generation', async () => {
    const f = fixture();
    const room = await f.pair();
    f.questions.createRankedQuestions.mockImplementationOnce(async () => {
      await f.service.leave(room.roomId, f.host);
    });
    await expect(f.service.start(room.roomId, f.host)).rejects.toThrow(
      'ROOM_CLOSED',
    );
    expect(f.matchesData[0]!.status).toBe('CANCELLED');
    expect(f.data).toHaveLength(0);
  });
  it('does not reset guest ready when the saved settings are unchanged', async () => {
    const f = fixture();
    const room = await f.pair();
    const snapshot = await f.service.update(
      room.roomId,
      f.host,
      ArenaFriendMode.CLASSIC,
      { questionCount: 10, timePerQuestion: 15 },
    );
    expect(snapshot.guestReady).toBe(true);
  });
  it('closes the room when the host fails to reconnect within grace', async () => {
    const f = fixture();
    await f.pair();
    f.data[0]!.hostDisconnectedAt = new Date(Date.now() - 21000);
    f.presence.isOnline.mockResolvedValue(false);
    const events = await f.service.tick();
    expect(events[0]!.event).toBe('friend-room:closed');
    expect(f.data).toHaveLength(0);
  });
  it('clears only the guest after a waiting guest reconnect timeout', async () => {
    const f = fixture();
    await f.pair();
    f.data[0]!.guestDisconnectedAt = new Date(Date.now() - 21000);
    f.presence.isOnline.mockResolvedValue(false);
    await f.service.tick();
    expect(f.data[0]!.guestId).toBeNull();
    expect(f.data[0]!.hostId).toEqual(new Types.ObjectId(f.host));
  });
  it('leaves active match disconnect resolution to the match lifecycle', async () => {
    const f = fixture();
    const room = await f.pair();
    await f.service.start(room.roomId, f.host);
    f.data[0]!.hostDisconnectedAt = new Date(Date.now() - 21000);
    f.presence.isOnline.mockResolvedValue(false);
    expect(await f.service.tick()).toEqual([]);
    expect(f.data[0]!.status).toBe('IN_MATCH');
  });
});

describe('Multiplayer friend rooms', () => {
  it.each([2, 9, 3.5, NaN, '4', null])(
    'rejects an invalid explicit capacity %j',
    async (capacity) => {
      const f = fixture();
      await expect(
        f.service.create(
          f.host,
          ArenaFriendMode.CLASSIC,
          {},
          capacity as number,
        ),
      ).rejects.toThrow('INVALID_ROOM_CAPACITY');
      expect(f.data).toHaveLength(0);
    },
  );
  it.each([3, 4, 5, 6, 7, 8])(
    'creates a room with capacity %i without creating a match',
    async (capacity) => {
      const f = fixture();
      const room = await f.service.create(
        f.host,
        ArenaFriendMode.CLASSIC,
        {},
        capacity,
      );
      expect(room.maxPlayers).toBe(capacity);
      expect(room.players).toHaveLength(1);
      expect(f.matchesData).toHaveLength(0);
    },
  );
  it('atomically fills all eight seats and rejects excess concurrent joins', async () => {
    const f = fixture();
    const room = await f.service.create(f.host, ArenaFriendMode.CLASSIC, {}, 8);
    const users = Array.from({ length: 10 }, () =>
      String(new Types.ObjectId()),
    );
    const results = await Promise.allSettled(
      users.map((id) => f.service.join(id, room.code)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(7);
    expect(
      (await f.service.snapshot(room.roomId, f.host)).players,
    ).toHaveLength(8);
    await expect(
      f.service.create(
        users.find((id) =>
          f.data[0]!.members.some((m: Row) => String(m.userId) === id),
        )!,
      ),
    ).rejects.toThrow('ALREADY_IN_ROOM');
  });
  it('requires at least three players and every guest ready, and starts only once', async () => {
    const f = fixture();
    const room = await f.service.create(f.host, ArenaFriendMode.CLASSIC, {}, 3);
    await f.service.join(f.guest, room.code);
    await f.service.ready(room.roomId, f.guest, true);
    await expect(f.service.start(room.roomId, f.host)).rejects.toThrow(
      'GUEST_NOT_READY',
    );
    await f.service.join(f.third, room.code);
    await expect(f.service.start(room.roomId, f.host)).rejects.toThrow(
      'GUEST_NOT_READY',
    );
    await f.service.ready(room.roomId, f.third, true);
    const starts = await Promise.allSettled([
      f.service.start(room.roomId, f.host),
      f.service.start(room.roomId, f.host),
    ]);
    expect(starts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.matchesData[0]).toMatchObject({
      type: 'ROOM',
      additionalPlayerIds: [f.third],
    });
    expect(f.matchService.createMatch).toHaveBeenCalledOnce();
  });
  it('resets all guests on settings changes and frees only the departing seat', async () => {
    const f = fixture();
    const room = await f.service.create(f.host, ArenaFriendMode.CLASSIC, {}, 4);
    await f.service.join(f.guest, room.code);
    await f.service.join(f.third, room.code);
    await f.service.ready(room.roomId, f.guest, true);
    await f.service.ready(room.roomId, f.third, true);
    const updated = await f.service.update(
      room.roomId,
      f.host,
      ArenaFriendMode.WORD_CHAIN,
      { turnTime: 30 },
    );
    expect(updated.players.every((p) => !p.isReady)).toBe(true);
    await f.service.leave(room.roomId, f.guest);
    const remaining = await f.service.snapshot(room.roomId, f.host);
    expect(remaining.players.map((p) => p.userId)).toEqual([f.host, f.third]);
    const closed = await f.service.leave(room.roomId, f.host);
    expect(closed.users).toEqual([f.host, f.third]);
    expect(closed.data).toMatchObject({ roomId: room.roomId, code: room.code, hostId: f.host, reason: 'HOST_LEFT' });
    expect(f.data).toHaveLength(0);
  });
});

describe('Word Guess lobby', () => {
  it('uses fixed five-letter/five-attempt rules without question or turn settings', async () => {
    expect(validateFriendSettings(ArenaFriendMode.WORD_GUESS, {})).toEqual({});
    expect(() =>
      validateFriendSettings(ArenaFriendMode.WORD_GUESS, { turnTime: 20 }),
    ).toThrow('INVALID_ROOM_SETTINGS');
    const f = fixture();
    const room = await f.pair();
    await f.service.update(room.roomId, f.host, ArenaFriendMode.WORD_GUESS, {});
    await f.service.ready(room.roomId, f.guest, true);
    await f.service.start(room.roomId, f.host);
    expect(f.matchesData[0]).toMatchObject({
      friendMode: 'WORD_GUESS',
      wordGuessAnswer: 'apple',
      questionMode: null,
      wordGuessAttempts: [],
    });
    expect(f.questions.createRankedQuestions).not.toHaveBeenCalled();
  });
});

describe('Room code type validation', () => {
  it('rejects a 1v1 code entered through Room without adding the guest', async () => {
    const f = fixture();
    const room = await f.create();
    await expect(f.service.join(f.guest, room.code, 'ROOM')).rejects.toThrow(
      'ROOM_TYPE_MISMATCH',
    );
    expect(f.data[0]!.guestId).toBeNull();
    expect(await f.service.active(f.guest)).toBeNull();
    expect((await f.service.join(f.guest, room.code, 'FRIEND')).guestId).toBe(
      f.guest,
    );
  });
  it('rejects a Room code entered through 1v1 without reserving a seat', async () => {
    const f = fixture();
    const room = await f.service.create(f.host, ArenaFriendMode.CLASSIC, {}, 8);
    await expect(f.service.join(f.guest, room.code, 'FRIEND')).rejects.toThrow(
      'ROOM_TYPE_MISMATCH',
    );
    expect(f.data[0]!.members).toHaveLength(0);
    expect(await f.service.active(f.guest)).toBeNull();
    expect(
      (await f.service.join(f.guest, room.code, 'ROOM')).players,
    ).toHaveLength(2);
  });
  it('validates the room type even when the target room is already full', async () => {
    const f = fixture();
    const room = await f.pair();
    await expect(f.service.join(f.third, room.code, 'ROOM')).rejects.toThrow(
      'ROOM_TYPE_MISMATCH',
    );
    expect(String(f.data[0]!.guestId)).toBe(f.guest);
  });
  it.each(['RANK', '', null])(
    'rejects invalid expected types %j',
    async (type) => {
      const f = fixture();
      const room = await f.create();
      await expect(
        f.service.join(f.guest, room.code, type as never),
      ).rejects.toThrow('INVALID_ROOM_TYPE');
      expect(f.data[0]!.guestId).toBeNull();
    },
  );
});

describe('Room capacity settings', () => {
  it('lets the host resize the lobby and resets all guest ready states', async () => {
    const f = fixture();
    const room = await f.service.create(f.host, ArenaFriendMode.CLASSIC, {}, 8);
    await f.service.join(f.guest, room.code, 'ROOM');
    await f.service.join(f.third, room.code, 'ROOM');
    await f.service.ready(room.roomId, f.guest, true);
    await f.service.ready(room.roomId, f.third, true);
    const smaller = await f.service.update(
      room.roomId,
      f.host,
      ArenaFriendMode.CLASSIC,
      {},
      3,
    );
    expect(smaller.maxPlayers).toBe(3);
    expect(smaller.players.every((p) => !p.isReady)).toBe(true);
    const fourth = String(new Types.ObjectId());
    await expect(f.service.join(fourth, room.code, 'ROOM')).rejects.toThrow(
      'ROOM_FULL',
    );
    const larger = await f.service.update(
      room.roomId,
      f.host,
      ArenaFriendMode.CLASSIC,
      {},
      8,
    );
    expect(larger.maxPlayers).toBe(8);
    expect(
      (await f.service.join(fourth, room.code, 'ROOM')).players,
    ).toHaveLength(4);
  });
  it('rejects shrinking below the current number of players without changing the room', async () => {
    const f = fixture();
    const room = await f.service.create(f.host, ArenaFriendMode.CLASSIC, {}, 8);
    for (const user of [f.guest, f.third, String(new Types.ObjectId())])
      await f.service.join(user, room.code, 'ROOM');
    await expect(
      f.service.update(room.roomId, f.host, ArenaFriendMode.CLASSIC, {}, 3),
    ).rejects.toThrow('ROOM_CAPACITY_TOO_SMALL');
    expect((await f.service.snapshot(room.roomId, f.host)).maxPlayers).toBe(8);
  });
  it.each([2, 9, 3.5, null, '4'])(
    'rejects invalid capacities %j',
    async (capacity) => {
      const f = fixture();
      const room = await f.service.create(
        f.host,
        ArenaFriendMode.CLASSIC,
        {},
        8,
      );
      await expect(
        f.service.update(
          room.roomId,
          f.host,
          ArenaFriendMode.CLASSIC,
          {},
          capacity as never,
        ),
      ).rejects.toThrow('INVALID_ROOM_CAPACITY');
      expect(f.data[0]!.maxPlayers).toBe(8);
    },
  );
  it('prevents guests from resizing and keeps 1v1 rooms fixed at two players', async () => {
    const f = fixture();
    const room = await f.pair();
    await expect(
      f.service.update(room.roomId, f.guest, ArenaFriendMode.CLASSIC, {}, 3),
    ).rejects.toThrow('NOT_ROOM_HOST');
    await expect(
      f.service.update(room.roomId, f.host, ArenaFriendMode.CLASSIC, {}, 3),
    ).rejects.toThrow('INVALID_ROOM_CAPACITY');
    expect((await f.service.snapshot(room.roomId, f.host)).maxPlayers).toBe(2);
  });
  it('preserves ready confirmations when the capacity and rules are unchanged', async () => {
    const f = fixture();
    const room = await f.service.create(f.host, ArenaFriendMode.CLASSIC, {}, 8);
    await f.service.join(f.guest, room.code, 'ROOM');
    await f.service.ready(room.roomId, f.guest, true);
    const unchanged = await f.service.update(
      room.roomId,
      f.host,
      ArenaFriendMode.CLASSIC,
      {},
      8,
    );
    expect(unchanged.players.find((p) => p.userId === f.guest)?.isReady).toBe(
      true,
    );
  });
  it('blocks resizing during an active match', async () => {
    const f = fixture();
    const room = await f.service.create(f.host, ArenaFriendMode.CLASSIC, {}, 8);
    f.data[0]!.status = 'IN_MATCH';
    await expect(
      f.service.update(room.roomId, f.host, ArenaFriendMode.CLASSIC, {}, 4),
    ).rejects.toThrow('ROOM_IN_MATCH');
  });
});
