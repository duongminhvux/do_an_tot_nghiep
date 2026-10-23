import { PgId } from '../../../postgres/compat.js';
import { ArenaFriendlyService } from './arena-friendly.service.js';

vi.mock('./arena-friend-room.service.js', () => ({
  ArenaFriendRoomService: class {} }));
vi.mock('../schemas/arena-match.schema.js', () => ({
  ArenaMatch: class {},
  ArenaFriendMode: {
    CLASSIC: 'CLASSIC',
    WORD_CHAIN: 'WORD_CHAIN',
    WORD_GUESS: 'WORD_GUESS' },
  ArenaMatchType: { FRIEND: 'FRIEND', ROOM: 'ROOM', RANK: 'RANK' },
  ArenaMatchStatus: {
    WAITING: 'WAITING',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    FINISHED: 'FINISHED',
    CANCELLED: 'CANCELLED' },
  ArenaMatchFinishReason: {
    TURN_TIMEOUT: 'TURN_TIMEOUT',
    PLAYER_LEFT: 'PLAYER_LEFT' } }));
vi.mock('../schemas/arena-invitation.schema.js', () => ({
  ArenaInvitation: class {} }));
vi.mock('../schemas/arena-match-player.schema.js', () => ({
  ArenaMatchPlayer: class {} }));
vi.mock('../../users/schema/user.schema.js', () => ({ User: class {} }));
vi.mock('../../vocabulary/words/word.schema.js', () => ({ Word: class {} }));

function fixture() {
  const user = String(new PgId());
  const opponent = String(new PgId());
  const match = {
    _id: new PgId(),
    type: 'FRIEND',
    status: 'PLAYING',
    hostId: new PgId(user),
    friendMode: 'WORD_CHAIN',
    currentTurnUserId: new PgId(user),
    currentWord: 'apple',
    requiredLetter: 'le',
    usedWords: ['apple'],
    turnCount: 1,
    turnStartedAt: new Date(),
    turnDeadline: new Date(Date.now() + 20000),
    chainPausedAt: null };
  const matches = {
    findById: vi.fn(async () => ({ ...match })),
    find: vi.fn(async () => []),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    findOneAndUpdate: vi.fn(async (filter, update) => {
      if (
        filter.turnCount !== undefined &&
        filter.turnCount !== match.turnCount
      )
        return null;
      if (
        filter.turnDeadline?.$gt &&
        match.turnDeadline.getTime() <= filter.turnDeadline.$gt.getTime()
      )
        return null;
      Object.assign(match, update.$set);
      if (update.$push) match.usedWords.push(update.$push.usedWords);
      if (update.$inc) match.turnCount += update.$inc.turnCount;
      return { ...match };
    }) };
  const invites = {
    find: vi.fn(async () => []),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })) };
  const players = {
    find: vi.fn(async () => [
      { userId: new PgId(user), isReady: false, status: 'PLAYING' },
      {
        userId: new PgId(opponent),
        isReady: true,
        readyMode: match.friendMode,
        status: 'PLAYING' },
    ]),
    updateOne: vi.fn(),
    updateMany: vi.fn() };
  const words = { exists: vi.fn(async () => true) };
  const matchService = {
    getOpponentUserId: vi.fn(async () => opponent),
    finishMatch: vi.fn(async () => true),
    findActiveMatchForUser: vi.fn(async () => null),
    createFriendMatch: vi.fn(async () => ({ match: { _id: match._id } })) };
  const rounds = {
    assertMember: vi.fn(),
    finishedEvent: vi.fn(async () => ({ event: 'match:finished', data: {} })),
    snapshot: vi.fn(async () => [{ event: 'match:question', data: {} }]) };
  const questions = { createRankedQuestions: vi.fn() };
  const presence = { isOnline: vi.fn(async () => true) };
  const users = {
    exists: vi.fn(async () => true),
    find: vi.fn(() => ({
      select: async () => [
        {
          _id: new PgId(user),
          username: 'Host',
          avatarUrl: undefined },
        {
          _id: new PgId(opponent),
          username: 'Guest',
          avatarUrl: undefined },
      ] })) };
  const arena = { getOrCreateProfile: vi.fn() };
  const friendRooms = {
    member: vi.fn(async () => ({ code: 'ABC234' })),
    join: vi.fn(async () => ({ code: 'ABC234', roomId: 'room-id' })),
    snapshot: vi.fn(async () => ({ code: 'ABC234', roomId: 'room-id' })) };
  const deps = [
    matches,
    invites,
    players,
    users,
    words,
    matchService,
    rounds,
    questions,
    presence,
    arena,
    friendRooms,
  ] as unknown as ConstructorParameters<typeof ArenaFriendlyService>;
  return {
    service: new ArenaFriendlyService(...deps),
    friendRooms,
    user,
    opponent,
    match,
    matches,
    invites,
    words,
    players,
    matchService,
    rounds,
    questions,
    presence };
}

describe('Friendly Word Chain', () => {
  it('normalizes a valid word, alternates the turn and starts a fresh deadline', async () => {
    const f = fixture();
    const before = Date.now();
    const events = await f.service.submit(
      String(f.match._id),
      f.user,
      '  ELEPHANT  ',
    );
    expect(f.match.usedWords).toEqual(['apple', 'elephant']);
    expect(String(f.match.currentTurnUserId)).toBe(f.opponent);
    expect(f.match.requiredLetter).toBe('t');
    expect(f.match.turnDeadline.getTime()).toBeGreaterThanOrEqual(
      before + 20000,
    );
    expect(events.map((e) => e.event)).toEqual([
      'word-chain:accepted',
      'word-chain:turn',
    ]);
  });
  it.each([
    ['house', 'INVALID_START_LETTER'],
    ['a', 'WORD_NOT_FOUND'],
    ['apple', 'WORD_ALREADY_USED'],
    ['two words', 'WORD_NOT_FOUND'],
    ['', 'WORD_NOT_FOUND'],
  ])('rejects %s without changing the deadline', async (word, reason) => {
    const f = fixture();
    if (word === 'apple') {
      f.match.currentWord = 'idea';
      f.match.requiredLetter = 'ap';
    }
    const deadline = f.match.turnDeadline.getTime();
    expect(
      (await f.service.submit(String(f.match._id), f.user, word))[0]?.data
        .reason,
    ).toBe(reason);
    expect(f.match.turnDeadline.getTime()).toBe(deadline);
    expect(f.matches.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('allows an unrestricted first word of at least two letters', async () => {
    const f = fixture();
    f.match.currentWord = '';
    f.match.requiredLetter = '';
    f.match.usedWords = [];
    const events = await f.service.submit(String(f.match._id), f.user, 'Apple');
    expect(events[0]?.event).toBe('word-chain:accepted');
    expect(f.match.requiredLetter).toBe('e');
  });
  it('requires the last single letter of the previous word', async () => {
    const f = fixture();
    const snapshot = await f.service.gameSnapshot(String(f.match._id));
    expect(snapshot[0]?.data.requiredLetter).toBe('e');
    const events = await f.service.submit(
      String(f.match._id),
      f.user,
      'elephant',
    );
    expect(events[0]?.event).toBe('word-chain:accepted');
  });
  it('checks the application vocabulary', async () => {
    const f = fixture();
    f.words.exists.mockResolvedValue(false);
    expect(
      (await f.service.submit(String(f.match._id), f.user, 'elephant'))[0]?.data
        .reason,
    ).toBe('WORD_NOT_FOUND');
  });
  it('rejects submissions from the other player', async () => {
    const f = fixture();
    expect(
      (await f.service.submit(String(f.match._id), f.opponent, 'elephant'))[0]
        ?.data.reason,
    ).toBe('NOT_YOUR_TURN');
  });
  it('checks the deadline again after slow dictionary lookup', async () => {
    const f = fixture();
    f.words.exists.mockImplementation(async () => {
      f.match.turnDeadline = new Date(Date.now() - 1);
      return true;
    });
    expect(
      (await f.service.submit(String(f.match._id), f.user, 'elephant'))[0]?.data
        .reason,
    ).toBe('TURN_EXPIRED');
    expect(f.match.usedWords).toEqual(['apple']);
  });
  it('accepts only one of two simultaneous submissions for a turn', async () => {
    const f = fixture();
    const results = await Promise.all([
      f.service.submit(String(f.match._id), f.user, 'elephant'),
      f.service.submit(String(f.match._id), f.user, 'environment'),
    ]);
    expect(
      results.filter((events) => events[0]?.event === 'word-chain:accepted'),
    ).toHaveLength(1);
    expect(f.match.turnCount).toBe(2);
  });
  it('finishes an expired turn with the opponent as winner', async () => {
    const f = fixture();
    f.matches.find.mockResolvedValueOnce([f.match] as never);
    const events = await f.service.tick();
    expect(f.matchService.finishMatch).toHaveBeenCalledWith(
      String(f.match._id),
      'TURN_TIMEOUT',
      f.opponent,
      f.match.turnCount,
    );
    expect(events[0]?.event).toBe('match:finished');
  });
});

describe('Friendly lifecycle', () => {
  it('accepting an invitation joins its room without creating a match', async () => {
    const f = fixture();
    const inviteId = new PgId();
    const roomId = new PgId();
    f.invites.findOneAndUpdate.mockResolvedValue({
      _id: inviteId,
      roomId,
      senderId: new PgId(f.user),
      receiverId: new PgId(f.opponent) });
    const result = await f.service.respond(f.opponent, String(inviteId), true);
    expect(result.event).toBe('friend:invite-accepted');
    expect(f.friendRooms.join).toHaveBeenCalledWith(f.opponent, 'ABC234');
    expect(f.matchService.createFriendMatch).not.toHaveBeenCalled();
  });
  it('declining notifies both users and creates no match', async () => {
    const f = fixture();
    const inviteId = new PgId();
    f.invites.findOneAndUpdate.mockResolvedValue({
      _id: inviteId,
      senderId: new PgId(f.user),
      receiverId: new PgId(f.opponent) });
    expect(
      (await f.service.respond(f.opponent, String(inviteId), false)).event,
    ).toBe('friend:invite-declined');
    expect(f.matchService.createFriendMatch).not.toHaveBeenCalled();
  });
  it('cancels and notifies both users if one becomes unavailable before acceptance', async () => {
    const f = fixture();
    const inviteId = new PgId();
    f.invites.findOneAndUpdate.mockResolvedValue({
      _id: inviteId,
      senderId: new PgId(f.user),
      receiverId: new PgId(f.opponent) });
    f.presence.isOnline.mockResolvedValue(false);
    const result = await f.service.respond(f.opponent, String(inviteId), true);
    expect(result.event).toBe('friend:invite-cancelled');
    expect(result.users).toEqual([f.user, f.opponent]);
    expect(f.matchService.createFriendMatch).not.toHaveBeenCalled();
  });
  it('expires pending invitations on the server and notifies both users', async () => {
    const f = fixture();
    const inviteId = new PgId();
    f.invites.find.mockResolvedValueOnce([
      {
        _id: inviteId,
        senderId: new PgId(f.user),
        receiverId: new PgId(f.opponent) },
    ] as never);
    const events = await f.service.tick();
    expect(events[0]).toMatchObject({
      event: 'friend:invite-expired',
      users: [f.user, f.opponent],
      data: { inviteId: String(inviteId) } });
    expect(f.invites.updateOne).toHaveBeenCalledWith(
      { _id: inviteId, status: 'PENDING' },
      { $set: { status: 'EXPIRED' } },
    );
  });
  it('does not accept expired or previously handled invitations', async () => {
    const f = fixture();
    f.invites.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      f.service.respond(f.user, String(new PgId()), true),
    ).rejects.toThrow('expired');
    expect(f.matchService.createFriendMatch).not.toHaveBeenCalled();
    expect(f.invites.findOneAndUpdate.mock.calls[0]?.[0]).toMatchObject({
      receiverId: new PgId(f.user),
      status: 'PENDING',
      expiresAt: { $gt: expect.any(Date) } });
  });
  it('requires room lifecycle events rather than starting a match lobby', async () => {
    const f = fixture();
    await expect(f.service.start(String(f.match._id), f.user)).rejects.toThrow(
      'friend-room:start',
    );
  });
});

describe('Returning to the Friendly room', () => {
  it('returns the existing room without creating another match', async () => {
    const f = fixture();
    Object.assign(f.match, {
      status: 'FINISHED',
      roomId: new PgId() });
    await f.service.returnToLobby(String(f.match._id), f.user);
    expect(f.friendRooms.snapshot).toHaveBeenCalledWith(
      String((f.match as { roomId?: PgId }).roomId),
      f.user,
    );
    expect(f.matchService.createFriendMatch).not.toHaveBeenCalled();
  });
  it('cannot return to a room that the host deleted', async () => {
    const f = fixture();
    Object.assign(f.match, {
      status: 'FINISHED',
      roomId: new PgId() });
    f.friendRooms.snapshot.mockRejectedValue(new Error('ROOM_NOT_FOUND'));
    await expect(
      f.service.returnToLobby(String(f.match._id), f.user),
    ).rejects.toThrow('ROOM_NOT_FOUND');
  });
});

function guessFixture() {
  const f = fixture();
  const match = f.match as any;
  Object.assign(match, {
    friendMode: 'WORD_GUESS',
    wordGuessAnswer: 'apple',
    wordGuessAttempts: [],
    wordGuessRevision: 0,
    wordGuessSolvedBy: null,
    roomRevision: 0,
    eliminatedUserIds: [] });
  (f.matches as any).findById = vi.fn(() => {
    const copy = { ...match, wordGuessAttempts: [...match.wordGuessAttempts] };
    return Object.assign(Promise.resolve(copy), { select: async () => copy });
  });
  (f.players as any).findOne = vi.fn(async () => ({ status: 'PLAYING' }));
  f.matches.findOneAndUpdate.mockImplementation(async (filter, update) => {
    if (
      filter.wordGuessRevision !== match.wordGuessRevision ||
      match.wordGuessSolvedBy
    )
      return null;
    match.wordGuessAttempts = [
      ...match.wordGuessAttempts,
      update.$push.wordGuessAttempts,
    ];
    match.wordGuessRevision++;
    Object.assign(match, update.$set);
    return { ...match };
  });
  f.matchService.finishMatch.mockImplementation(
    async (_id?: any, _reason?: any, winner?: any) => {
      match.status = 'FINISHED';
      match.winnerId = winner;
      match.isDraw = !winner;
      return true;
    },
  );
  return { ...f, match };
}

describe('Word Guess match', () => {
  it('keeps the answer and opponents guesses private during play', async () => {
    const f = guessFixture();
    const state = await f.service.submitWordGuess(
      String(f.match._id),
      f.user,
      'PEARL',
    );
    expect(state.attempts[0]).toEqual({
      word: 'pearl',
      feedback: ['present', 'present', 'present', 'absent', 'present'] });
    expect(state).not.toHaveProperty('answer');
    const opponent = await f.service.wordGuessSnapshot(
      String(f.match._id),
      f.opponent,
    );
    expect(opponent.attempts).toHaveLength(0);
    expect(opponent.players.find((p) => p.userId === f.user)?.attempts).toBe(1);
  });
  it('rejects invalid lengths and repeated guesses without spending attempts', async () => {
    const f = guessFixture();
    await expect(
      f.service.submitWordGuess(String(f.match._id), f.user, 'abcd'),
    ).rejects.toThrow('WORD_MUST_HAVE_FIVE_LETTERS');
    await f.service.submitWordGuess(String(f.match._id), f.user, 'pearl');
    await expect(
      f.service.submitWordGuess(String(f.match._id), f.user, 'pearl'),
    ).rejects.toThrow('WORD_ALREADY_GUESSED');
    expect(f.match.wordGuessAttempts).toHaveLength(1);
  });
  it('enforces exactly five attempts even for concurrent submissions', async () => {
    const f = guessFixture();
    const words = ['bound', 'trace', 'crane', 'slate', 'money', 'crown'];
    const results = await Promise.allSettled(
      words.map((word) =>
        f.service.submitWordGuess(String(f.match._id), f.user, word),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    expect(f.match.wordGuessAttempts).toHaveLength(5);
    expect(f.match.status).toBe('PLAYING');
  });
  it('finishes with the first correct guess and reveals the answer only afterward', async () => {
    const f = guessFixture();
    const state = await f.service.submitWordGuess(
      String(f.match._id),
      f.user,
      ' APPLE ',
    );
    expect(state).toMatchObject({
      status: 'FINISHED',
      answer: 'apple',
      winnerId: f.user });
    expect(f.players.updateOne).toHaveBeenCalledWith(expect.anything(), {
      $set: { score: 500 } });
    await expect(
      f.service.submitWordGuess(String(f.match._id), f.opponent, 'apple'),
    ).rejects.toThrow('GAME_NOT_PLAYING');
  });
  it('declares a draw when all players have used five unsuccessful guesses', async () => {
    const f = guessFixture();
    for (const player of [f.user, f.opponent])
      for (const word of ['bound', 'trace', 'crane', 'slate', 'money'])
        await f.service.submitWordGuess(String(f.match._id), player, word);
    expect(
      await f.service.wordGuessSnapshot(String(f.match._id), f.user),
    ).toMatchObject({ status: 'FINISHED', isDraw: true, answer: 'apple' });
  });
});
