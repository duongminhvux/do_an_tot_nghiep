import { Types } from 'mongoose';
import { ArenaFriendlyService } from './arena-friendly.service.js';
import { ArenaFriendMode } from '../schemas/arena-match.schema.js';

vi.mock('../schemas/arena-match.schema.js', () => ({
  ArenaMatch: class {},
  ArenaFriendMode: { CLASSIC: 'CLASSIC', WORD_CHAIN: 'WORD_CHAIN' },
  ArenaMatchType: { FRIEND: 'FRIEND', RANK: 'RANK' },
  ArenaMatchStatus: {
    WAITING: 'WAITING',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    FINISHED: 'FINISHED',
    CANCELLED: 'CANCELLED',
  },
  ArenaMatchFinishReason: {
    TURN_TIMEOUT: 'TURN_TIMEOUT',
    PLAYER_LEFT: 'PLAYER_LEFT',
  },
}));
vi.mock('../schemas/arena-invitation.schema.js', () => ({
  ArenaInvitation: class {},
}));
vi.mock('../schemas/arena-match-player.schema.js', () => ({
  ArenaMatchPlayer: class {},
}));
vi.mock('../../users/schema/user.schema.js', () => ({ User: class {} }));
vi.mock('../../vocabulary/words/word.schema.js', () => ({ Word: class {} }));

function fixture() {
  const user = String(new Types.ObjectId());
  const opponent = String(new Types.ObjectId());
  const match = {
    _id: new Types.ObjectId(),
    type: 'FRIEND',
    status: 'PLAYING',
    hostId: new Types.ObjectId(user),
    friendMode: 'WORD_CHAIN',
    currentTurnUserId: new Types.ObjectId(user),
    currentWord: 'apple',
    requiredLetter: 'e',
    usedWords: ['apple'],
    turnCount: 1,
    turnStartedAt: new Date(),
    turnDeadline: new Date(Date.now() + 20000),
    chainPausedAt: null,
  };
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
    }),
  };
  const invites = {
    find: vi.fn(async () => []),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
  };
  const players = {
    find: vi.fn(async () => [
      { userId: new Types.ObjectId(user), isReady: false, status: 'PLAYING' },
      {
        userId: new Types.ObjectId(opponent),
        isReady: true,
        readyMode: match.friendMode,
        status: 'PLAYING',
      },
    ]),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
  };
  const words = { exists: vi.fn(async () => true) };
  const matchService = {
    getOpponentUserId: vi.fn(async () => opponent),
    finishMatch: vi.fn(async () => true),
    findActiveMatchForUser: vi.fn(async () => null),
    createFriendMatch: vi.fn(async () => ({ match: { _id: match._id } })),
  };
  const rounds = {
    assertMember: vi.fn(),
    finishedEvent: vi.fn(async () => ({ event: 'match:finished', data: {} })),
    snapshot: vi.fn(async () => [{ event: 'match:question', data: {} }]),
  };
  const questions = { createRankedQuestions: vi.fn() };
  const presence = { isOnline: vi.fn(async () => true) };
  const users = { exists: vi.fn(async () => true) };
  const arena = { getOrCreateProfile: vi.fn() };
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
  ] as unknown as ConstructorParameters<typeof ArenaFriendlyService>;
  return {
    service: new ArenaFriendlyService(...deps),
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
    presence,
  };
}

describe('Friendly Word Chain', () => {
  it('normalizes a valid word, alternates the turn and starts a fresh deadline', async () => {
    const f = fixture();
    const before = Date.now();
    const events = await f.service.submit(
      String(f.match._id),
      f.user,
      '  ENVIRONMENT  ',
    );
    expect(f.match.usedWords).toEqual(['apple', 'environment']);
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
    ['apple', 'WORD_ALREADY_USED'],
    ['two words', 'WORD_NOT_FOUND'],
    ['', 'WORD_NOT_FOUND'],
  ])('rejects %s without changing the deadline', async (word, reason) => {
    const f = fixture();
    if (word === 'apple') f.match.requiredLetter = 'a';
    const deadline = f.match.turnDeadline.getTime();
    expect(
      (await f.service.submit(String(f.match._id), f.user, word))[0]?.data
        .reason,
    ).toBe(reason);
    expect(f.match.turnDeadline.getTime()).toBe(deadline);
    expect(f.matches.findOneAndUpdate).not.toHaveBeenCalled();
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
  it('creates the chosen Friendly mode with the invitation sender as host', async () => {
    const f = fixture();
    const inviteId = new Types.ObjectId();
    f.invites.findOneAndUpdate.mockResolvedValue({
      _id: inviteId,
      senderId: new Types.ObjectId(f.user),
      receiverId: new Types.ObjectId(f.opponent),
      mode: ArenaFriendMode.WORD_CHAIN,
    });
    const result = await f.service.respond(f.opponent, String(inviteId), true);
    expect(f.matchService.createFriendMatch).toHaveBeenCalledWith(
      f.user,
      f.opponent,
      ArenaFriendMode.WORD_CHAIN,
    );
    expect(result.event).toBe('friend:match-created');
    expect(result.users).toEqual([f.user, f.opponent]);
  });
  it('declining notifies both users and creates no match', async () => {
    const f = fixture();
    const inviteId = new Types.ObjectId();
    f.invites.findOneAndUpdate.mockResolvedValue({
      _id: inviteId,
      senderId: new Types.ObjectId(f.user),
      receiverId: new Types.ObjectId(f.opponent),
    });
    expect(
      (await f.service.respond(f.opponent, String(inviteId), false)).event,
    ).toBe('friend:invite-declined');
    expect(f.matchService.createFriendMatch).not.toHaveBeenCalled();
  });
  it('cancels and notifies both users if one becomes unavailable before acceptance', async () => {
    const f = fixture();
    const inviteId = new Types.ObjectId();
    f.invites.findOneAndUpdate.mockResolvedValue({
      _id: inviteId,
      senderId: new Types.ObjectId(f.user),
      receiverId: new Types.ObjectId(f.opponent),
    });
    f.presence.isOnline.mockResolvedValue(false);
    const result = await f.service.respond(f.opponent, String(inviteId), true);
    expect(result.event).toBe('friend:invite-cancelled');
    expect(result.users).toEqual([f.user, f.opponent]);
    expect(f.matchService.createFriendMatch).not.toHaveBeenCalled();
  });
  it('expires pending invitations on the server and notifies both users', async () => {
    const f = fixture();
    const inviteId = new Types.ObjectId();
    f.invites.find.mockResolvedValueOnce([
      {
        _id: inviteId,
        senderId: new Types.ObjectId(f.user),
        receiverId: new Types.ObjectId(f.opponent),
      },
    ] as never);
    const events = await f.service.tick();
    expect(events[0]).toMatchObject({
      event: 'friend:invite-expired',
      users: [f.user, f.opponent],
      data: { inviteId: String(inviteId) },
    });
    expect(f.invites.updateOne).toHaveBeenCalledWith(
      { _id: inviteId, status: 'PENDING' },
      { $set: { status: 'EXPIRED' } },
    );
  });
  it('does not accept expired or previously handled invitations', async () => {
    const f = fixture();
    f.invites.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      f.service.respond(f.user, String(new Types.ObjectId()), true),
    ).rejects.toThrow('expired');
    expect(f.matchService.createFriendMatch).not.toHaveBeenCalled();
    expect(f.invites.findOneAndUpdate.mock.calls[0]?.[0]).toMatchObject({
      receiverId: new Types.ObjectId(f.user),
      status: 'PENDING',
      expiresAt: { $gt: expect.any(Date) },
    });
  });
  it('only allows the host to start', async () => {
    const f = fixture();
    f.match.status = 'WAITING';
    await expect(
      f.service.start(String(f.match._id), f.opponent),
    ).rejects.toThrow('host');
  });
  it('does not start until the opponent is ready', async () => {
    const f = fixture();
    f.match.status = 'WAITING';
    f.players.find.mockResolvedValueOnce([
      {
        userId: new Types.ObjectId(f.opponent),
        isReady: false,
        status: 'PLAYING',
      },
    ] as never);
    await expect(f.service.start(String(f.match._id), f.user)).rejects.toThrow(
      'ready',
    );
  });
  it('starts Word Chain with the host and no Ranked questions', async () => {
    const f = fixture();
    f.match.status = 'WAITING';
    await f.service.start(String(f.match._id), f.user);
    expect(String(f.match.currentTurnUserId)).toBe(f.user);
    expect(f.questions.createRankedQuestions).not.toHaveBeenCalled();
    expect(f.match.status).toBe('PLAYING');
  });
  it('Classic uses the existing Ranked question generator', async () => {
    const f = fixture();
    f.match.status = 'WAITING';
    f.match.friendMode = ArenaFriendMode.CLASSIC;
    await f.service.start(String(f.match._id), f.user);
    expect(f.questions.createRankedQuestions).toHaveBeenCalledWith(
      String(f.match._id),
      10,
    );
    expect(f.rounds.snapshot).toHaveBeenCalled();
  });
  it('leaving the lobby cancels without choosing a winner', async () => {
    const f = fixture();
    f.match.status = 'WAITING';
    expect((await f.service.leave(String(f.match._id), f.user))[0]?.event).toBe(
      'friend:cancelled',
    );
    expect(f.matchService.finishMatch).not.toHaveBeenCalled();
  });
});
