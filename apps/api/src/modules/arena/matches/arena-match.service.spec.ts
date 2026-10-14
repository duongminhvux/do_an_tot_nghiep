import { Types } from 'mongoose';
import { ArenaMatchService } from './arena-match.service.js';

vi.mock('../schemas/arena-match.schema.js', () => ({
  ArenaMatch: class {},
  ArenaMatchStatus: {
    PLAYING: 'PLAYING',
    FINISHING: 'FINISHING',
    FINISHED: 'FINISHED',
    WAITING: 'WAITING',
  },
  ArenaMatchType: { RANK: 'RANK', FRIEND: 'FRIEND' },
  ArenaFriendMode: { WORD_CHAIN: 'WORD_CHAIN', CLASSIC: 'CLASSIC' },
  ArenaMatchFinishReason: { NORMAL: 'NORMAL' },
}));
vi.mock('../schemas/arena-match-player.schema.js', () => ({
  ArenaMatchPlayer: class {},
}));
vi.mock('../schemas/arena-profile.schema.js', () => ({
  ArenaProfile: class {},
}));
vi.mock('../schemas/arena-rating-history.schema.js', () => ({
  ArenaRatingHistory: class {},
}));

function fixture() {
  const match = {
    _id: new Types.ObjectId(),
    type: 'FRIEND',
    status: 'PLAYING',
    winnerId: null,
    friendMode: 'WORD_CHAIN',
    chainPausedAt: null as Date | null,
    turnDeadline: new Date(Date.now() + 15000),
  };
  const players = [0, 1].map((i) => ({
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    score: i ? 80 : 100,
    ratingBefore: 1000,
  }));
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
    }),
  };
  const playerModel = {
    find: vi.fn(() => ({ sort: vi.fn(async () => players) })),
    updateOne: vi.fn(async (_filter: unknown, _update: unknown) => ({
      modifiedCount: 1,
    })),
    exists: vi.fn(async () => false),
    findOne: vi.fn(async () => ({
      disconnectedAt: new Date(Date.now() - 5000),
    })),
    distinct: vi.fn(async () => [match._id]),
  };
  const profiles = {
    updateOne: vi.fn(),
    findOne: vi.fn(async () => ({ currentWinStreak: 0, bestWinStreak: 0 })),
  };
  const history = { updateOne: vi.fn() };
  const rating = {
    calculateMatch: vi.fn(() => ({
      playerA: { ratingAfter: 1010, ratingChange: 10 },
      playerB: { ratingAfter: 990, ratingChange: -10 },
    })),
  };
  const deps = [
    {},
    matches,
    playerModel,
    profiles,
    history,
    {},
    rating,
  ] as unknown as ConstructorParameters<typeof ArenaMatchService>;
  return {
    service: new ArenaMatchService(...deps),
    match,
    players,
    matches,
    playerModel,
    profiles,
    history,
    rating,
  };
}

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
      $set: { ratingAfter: 1000, ratingChange: 0 },
    });
  });
  it('equal Classic scores produce a draw', async () => {
    const f = fixture();
    f.players[1]!.score = 100;
    expect(await f.service.finishMatch(String(f.match._id))).toMatchObject({
      isDraw: true,
      winnerId: null,
    });
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
      disconnectedAt: new Date(Date.now() - 21000),
    });
    await expect(
      f.service.markReconnected(
        String(f.match._id),
        String(f.players[0]!.userId),
      ),
    ).rejects.toThrow('expired');
    expect(f.playerModel.updateOne).not.toHaveBeenCalled();
  });
});
