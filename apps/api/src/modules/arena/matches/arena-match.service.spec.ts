import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { PgId } from '../../../postgres/compat.js';
vi.mock('../../../postgres/compat.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../postgres/compat.js')>();
  return { ...original, makePgModel: (name: string, client: any) => client.models[name] };
});
vi.mock('../question/arena-question.service.js', () => ({
  ArenaQuestionService: class {} }));
vi.mock('../rating/arena-rating.service.js', () => ({
  ArenaRatingService: class {} }));
import { ArenaMatchService } from './arena-match.service.js';

vi.mock('../schemas/friend-room.schema.js', () => ({
  FriendRoom: class {},
  FriendRoomStatus: { WAITING: 'WAITING' } }));
vi.mock('../schemas/arena-match.schema.js', () => ({
  ArenaMatch: class {},
  ArenaMatchStatus: {
    PLAYING: 'PLAYING',
    FINISHING: 'FINISHING',
    FINISHED: 'FINISHED',
    WAITING: 'WAITING' },
  ArenaMatchType: { RANK: 'RANK', FRIEND: 'FRIEND', ROOM: 'ROOM' },
  ArenaQuestionMode: { MEANING_TO_WORD: 'MEANING_TO_WORD' },
  ArenaFriendMode: {
    WORD_CHAIN: 'WORD_CHAIN',
    WORD_GUESS: 'WORD_GUESS',
    CLASSIC: 'CLASSIC' },
  ArenaMatchFinishReason: { NORMAL: 'NORMAL' } }));
vi.mock('../schemas/arena-match-player.schema.js', () => ({
  ArenaMatchPlayer: class {} }));
vi.mock('../schemas/arena-profile.schema.js', () => ({
  ArenaProfile: class {} }));
vi.mock('../schemas/arena-rating-history.schema.js', () => ({
  ArenaRatingHistory: class {} }));

function fixture() {
  const match = {
    _id: new PgId(),
    type: 'FRIEND',
    status: 'PLAYING',
    winnerId: null,
    friendMode: 'WORD_CHAIN',
    chainPausedAt: null as Date | null,
    turnDeadline: new Date(Date.now() + 15000) };
  const players = [0, 1].map((i) => ({
    _id: new PgId(),
    userId: new PgId(),
    score: i ? 80 : 100,
    ratingBefore: 1000 }));
  const matches = {
    findById: vi.fn(async () => match),
    findOne: vi.fn(async () => match),
    updateOne: vi.fn(
      async (_filter: unknown, update: { $set: Partial<typeof match> }) => {
        Object.assign(match, update.$set);
        return { modifiedCount: 1 };
      },
    ),
    findOneAndUpdate: vi.fn(async (_filter, update) => {
      Object.assign(match, update.$set);
      return { ...match };
    }) };
  const playerModel = {
    find: vi.fn(() => ({ sort: vi.fn(async () => players) })),
    updateOne: vi.fn(async (_filter: unknown, _update: unknown) => ({
      modifiedCount: 1 })),
    exists: vi.fn(async () => false),
    findOne: vi.fn(async () => ({
      disconnectedAt: new Date(Date.now() - 5000) })),
    distinct: vi.fn(async () => [match._id]) };
  const profiles = {
    updateOne: vi.fn(),
    findOne: vi.fn(async () => ({ currentWinStreak: 0, bestWinStreak: 0 })) };
  const history = { updateOne: vi.fn() };
  const rating = {
    calculateMatch: vi.fn(() => ({
      playerA: { ratingAfter: 1010, ratingChange: 10 },
      playerB: { ratingAfter: 990, ratingChange: -10 } })) };
  const friendRooms = { updateOne: vi.fn(), findOne: vi.fn(async () => null) };
  const outbox = {
    withTransaction: vi.fn(async (work: any) => work({ client: { models: {
      ArenaMatch: matches, ArenaMatchPlayer: playerModel, ArenaProfile: profiles, ArenaRatingHistory: history,
    } } })),
    enqueue: vi.fn(async () => 'event-id'),
  };
  const deps = [
    {},
    matches,
    playerModel,
    profiles,
    history,
    {},
    rating,
    friendRooms,
    undefined,
    undefined,
    outbox,
  ] as unknown as ConstructorParameters<typeof ArenaMatchService>;
  return {
    service: new ArenaMatchService(...deps),
    friendRooms,
    match,
    players,
    matches,
    playerModel,
    profiles,
    history,
    outbox,
    rating };
}

describe('Learning activity', () => {
  it('enqueues one activity per player in the result transaction with win XP for the winner only', async () => {
    const f = fixture();
    f.match.friendMode = 'CLASSIC';
    await f.service.finishMatch(String(f.match._id));
    expect(f.outbox.withTransaction).toHaveBeenCalledTimes(1);
    expect(f.outbox.enqueue).toHaveBeenCalledTimes(2);
    const calls = f.outbox.enqueue.mock.calls.map((call: any) => {
      expect(call[0]).toBe('learning.activity.recorded.v1');
      expect(call[3].client).toBeDefined();
      return call[2];
    });
    expect(calls.map((c) => String(c.userId))).toEqual(
      f.players.map((p) => String(p.userId)),
    );
    expect(calls.map((c) => c.xp)).toEqual([20, 10]);
    expect(calls[0]).toMatchObject({
      module: 'ARENA',
      sourceKey: `arena:${f.match._id}`,
      score: 100,
      metadata: { won: true, isDraw: false } });
  });
});

describe('Friendly results and reconnect', () => {
  it('finishes Classic without touching ranked profiles, rating history or Elo', async () => {
    const f = fixture();
    f.match.friendMode = 'CLASSIC';
    const result = await f.service.finishMatch(String(f.match._id));
    expect(String(result?.winnerId)).toBe(String(f.players[0]!.userId));
    expect(f.rating.calculateMatch).not.toHaveBeenCalled();
    expect(f.profiles.updateOne).not.toHaveBeenCalled();
    expect(f.history.updateOne).not.toHaveBeenCalled();
    expect(f.playerModel.updateOne.mock.calls[0]?.[1]).toMatchObject({
      $set: { ratingAfter: 1000, ratingChange: 0 } });
  });
  it('resets the existing room after a Friendly match without changing its settings', async () => {
    const f = fixture();
    const roomId = new PgId();
    Object.assign(f.match, { roomId });
    await f.service.finishMatch(String(f.match._id));
    expect(f.friendRooms.updateOne).toHaveBeenCalledWith(
      { _id: roomId, currentMatchId: f.match._id },
      {
        $set: { status: 'WAITING', currentMatchId: null, guestReady: false },
        $inc: { revision: 1 } },
    );
  });
  it('equal Classic scores produce a draw', async () => {
    const f = fixture();
    f.players[1]!.score = 100;
    expect(await f.service.finishMatch(String(f.match._id))).toMatchObject({
      isDraw: true,
      winnerId: null });
  });
  it('Word Chain can force a winner even when scores are equal', async () => {
    const f = fixture();
    f.players[1]!.score = 100;
    const result = await f.service.finishMatch(
      String(f.match._id),
      undefined,
      String(f.players[1]!.userId),
    );
    expect(result?.isDraw).toBe(false);
    expect(String(result?.winnerId)).toBe(String(f.players[1]!.userId));
    expect(f.history.updateOne).not.toHaveBeenCalled();
  });
  it('Ranked still calculates Elo and writes rating history', async () => {
    const f = fixture();
    f.match.type = 'RANK';
    await f.service.finishMatch(String(f.match._id));
    expect(f.rating.calculateMatch).toHaveBeenCalledOnce();
    expect(f.profiles.updateOne).toHaveBeenCalledTimes(2);
    expect(f.history.updateOne).toHaveBeenCalledTimes(2);
  });
  it('reconnecting resumes the same turn with its remaining time', async () => {
    const f = fixture();
    f.match.chainPausedAt = new Date(Date.now() - 5000);
    const deadline = f.match.turnDeadline.getTime();
    await f.service.markReconnected(
      String(f.match._id),
      String(f.players[0]!.userId),
    );
    expect(f.match.turnDeadline.getTime()).toBeGreaterThanOrEqual(
      deadline + 5000,
    );
    expect(
      f.matches.updateOne.mock.calls[0]?.[1].$set.chainPausedAt,
    ).toBeNull();
  });
  it('rejects a reconnect after the server grace period', async () => {
    const f = fixture();
    f.playerModel.findOne.mockResolvedValueOnce({
      disconnectedAt: new Date(Date.now() - 21000) });
    await expect(
      f.service.markReconnected(
        String(f.match._id),
        String(f.players[0]!.userId),
      ),
    ).rejects.toThrow('expired');
    expect(f.playerModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('Room match results and turns', () => {
  it('finishes every player and honors a winner outside the first two without Elo changes', async () => {
    const f = fixture();
    f.match.type = 'ROOM';
    f.players.push({
      _id: new PgId(),
      userId: new PgId(),
      score: 60,
      ratingBefore: 1200 });
    const third = f.players[2]!;
    const result = await f.service.finishMatch(
      String(f.match._id),
      undefined,
      String(third.userId),
    );
    expect(String(result?.winnerId)).toBe(String(third.userId));
    expect(f.playerModel.updateOne).toHaveBeenCalledTimes(3);
    expect(f.rating.calculateMatch).not.toHaveBeenCalled();
    expect(f.history.updateOne).not.toHaveBeenCalled();
    expect(f.profiles.updateOne).not.toHaveBeenCalled();
  });
  it('rotates turns through all members and skips eliminated players', async () => {
    const f = fixture();
    f.match.type = 'ROOM';
    f.players.push({
      _id: new PgId(),
      userId: new PgId(),
      score: 0,
      ratingBefore: 1000 });
    const ids = f.players.map((p) => String(p.userId));
    expect(await f.service.nextRoomPlayer(String(f.match._id), ids[0]!)).toBe(
      ids[1],
    );
    expect(await f.service.nextRoomPlayer(String(f.match._id), ids[1]!)).toBe(
      ids[2],
    );
    expect(await f.service.nextRoomPlayer(String(f.match._id), ids[2]!)).toBe(
      ids[0],
    );
    Object.assign(f.match, { eliminatedUserIds: [f.players[1]!.userId] });
    expect(await f.service.nextRoomPlayer(String(f.match._id), ids[0]!)).toBe(
      ids[2],
    );
  });
  it('eliminates a timed-out player and continues until only one survivor remains', async () => {
    const f = fixture();
    f.match.type = 'ROOM';
    f.players.push({
      _id: new PgId(),
      userId: new PgId(),
      score: 0,
      ratingBefore: 1000 });
    Object.assign(f.match, {
      currentTurnUserId: f.players[0]!.userId,
      turnCount: 0,
      eliminatedUserIds: [] });
    await f.service.dropRoomPlayer(
      String(f.match._id),
      String(f.players[0]!.userId),
      'TURN_TIMEOUT' as never,
    );
    expect(f.match.status).toBe('PLAYING');
    expect((f.match as any).turnCount).toBe(0);
    expect(String((f.match as any).currentTurnUserId)).toBe(
      String(f.players[1]!.userId),
    );
    const survivor = String(f.players[2]!.userId);
    const result = await f.service.dropRoomPlayer(
      String(f.match._id),
      String(f.players[1]!.userId),
      'TURN_TIMEOUT' as never,
    );
    expect(result?.status).toBe('FINISHED');
    expect(String(result?.winnerId)).toBe(survivor);
  });
});

describe('Room match creation', () => {
  it('reserves and persists every participant, including the third player', async () => {
    const ids = Array.from({ length: 3 }, () => String(new PgId()));
    const redis = {
      set: vi.fn(
        async (_key: string, _token: string, _options: unknown) => 'OK',
      ),
      eval: vi.fn(async () => 1) };
    const matches = {
      create: vi.fn(async (values) => ({
        _id: new PgId(),
        ...values })) };
    const players = { insertMany: vi.fn(async (values) => values) };
    const profiles = { findOne: vi.fn(async () => ({ rating: 1000 })) };
    const rooms = { findOne: vi.fn(async (_filter: unknown) => null) };
    const deps = [
      { getClient: () => redis },
      matches,
      players,
      profiles,
      {},
      {},
      {},
      rooms,
    ] as unknown as ConstructorParameters<typeof ArenaMatchService>;
    const service = new ArenaMatchService(...deps);
    vi.spyOn(service, 'findActiveMatchForUser').mockResolvedValue(null);
    const created = await service.createMatch(ids[0]!, ids[1]!, {
      type: 'ROOM' as never,
      additionalPlayerIds: [ids[2]!],
      roomId: new PgId(),
      settingsSnapshot: { questionCount: 10, timePerQuestion: 15 },
      questionMode: 'MEANING_TO_WORD' as never });
    expect(created.players.map((p: any) => String(p.userId))).toEqual(ids);
    expect(redis.set.mock.calls.map((call) => call[0])).toEqual(
      [...ids].sort().map((id) => `arena:create-match:${id}`),
    );
    expect(redis.eval).toHaveBeenCalledTimes(3);
    expect(profiles.findOne).toHaveBeenCalledTimes(3);
    expect(created.match.type).toBe('ROOM');
    expect(created.match.audioSettings).toEqual(ARENA_DEFAULTS.audio);
    expect(created.match.audioSettings).not.toBe(ARENA_DEFAULTS.audio);
    expect(String(created.match.hostId)).toBe(ids[0]);
    expect(rooms.findOne.mock.calls[0]?.[0]).toMatchObject({
      $or: expect.arrayContaining([
        { 'members.userId': { $in: ids.map((id) => new PgId(id)) } },
      ]) });
  });
});

describe('Word Guess room departures', () => {
  it('finishes a draw if the remaining players already exhausted their guesses', async () => {
    const f = fixture();
    f.match.type = 'ROOM';
    f.match.friendMode = 'WORD_GUESS';
    f.players.push({
      _id: new PgId(),
      userId: new PgId(),
      score: 0,
      ratingBefore: 1000 });
    f.players.forEach((p) => (p.score = 0));
    Object.assign(f.match, {
      turnCount: 0,
      roomRevision: 0,
      eliminatedUserIds: [],
      wordGuessAttempts: f.players.slice(1).flatMap((p) =>
        Array.from({ length: 5 }, () => ({
          userId: String(p.userId),
          word: 'crane',
          feedback: [] })),
      ) });
    const result = await f.service.dropRoomPlayer(
      String(f.match._id),
      String(f.players[0]!.userId),
      'PLAYER_LEFT' as never,
    );
    expect(result).toMatchObject({
      status: 'FINISHED',
      isDraw: true,
      winnerId: null });
  });
});
