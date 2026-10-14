import { ArenaGateway } from './arena.gateway.js';
import type { Socket } from 'socket.io';
vi.mock('../../auth/auth.service.js', () => ({ AuthService: class {} }));
vi.mock('../matchmaking/arena-matchmaking.service.js', () => ({
  ArenaMatchmakingService: class {},
}));
vi.mock('../presence/arena-presence.service.js', () => ({
  ArenaPresenceService: class {},
}));
vi.mock('../matches/arena-match.service.js', () => ({
  ArenaMatchService: class {},
}));
vi.mock('../question/arena-round.service.js', () => ({
  ArenaRoundService: class {},
}));
vi.mock('../friendly/arena-friendly.service.js', () => ({
  ArenaFriendlyService: class {},
}));

vi.mock('../schemas/arena-match.schema.js', () => ({
  ArenaMatchFinishReason: { PLAYER_LEFT: 'PLAYER_LEFT' },
  ArenaFriendMode: { CLASSIC: 'CLASSIC', WORD_CHAIN: 'WORD_CHAIN' },
  ArenaMatchType: { RANK: 'RANK', FRIEND: 'FRIEND' },
  ArenaMatchStatus: { PLAYING: 'PLAYING' },
}));

function fixture(type = 'RANK', online = false) {
  const match = { _id: 'match-id', type, status: 'PLAYING' };
  const matches = {
    findActiveMatchForUser: vi.fn().mockResolvedValue(match),
    getOpponentUserId: vi.fn().mockResolvedValue('opponent-id'),
    finishRankedMatch: vi.fn(async () => {
      matches.findActiveMatchForUser.mockResolvedValue(null);
      return match;
    }),
    markDisconnected: vi.fn(),
  };
  const rounds = {
    assertMember: vi.fn(),
    snapshot: vi
      .fn()
      .mockResolvedValue([
        { event: 'match:finished', data: { winnerId: 'opponent-id' } },
      ]),
  };
  const friendly = {
    leave: vi
      .fn()
      .mockResolvedValue([
        { event: 'friend:match-finished', data: { winnerId: 'opponent-id' } },
      ]),
  };
  const presence = { disconnect: vi.fn().mockResolvedValue({ online }) };
  const matchmaking = { leaveQueue: vi.fn() };
  const deps = [
    friendly,
    matchmaking,
    matches,
    presence,
    {},
    rounds,
  ] as unknown as ConstructorParameters<typeof ArenaGateway>;
  const gateway = new ArenaGateway(...deps);
  const emit = vi.fn();
  gateway.server = { to: vi.fn(() => ({ emit })) } as never;
  const client = {
    id: 'socket-id',
    data: { userId: 'user-id', activeMatchId: 'match-id' },
  } as unknown as Socket;
  return { gateway, matches, friendly, rounds, emit, client };
}

describe('Arena leaving an active match', () => {
  it('an explicit ranked exit immediately awards the opponent the win', async () => {
    const f = fixture();
    expect(
      await f.gateway.handleMatchLeave(f.client, { matchId: 'match-id' }),
    ).toMatchObject({ success: true });
    expect(f.matches.finishRankedMatch).toHaveBeenCalledWith(
      'match-id',
      'PLAYER_LEFT',
      'opponent-id',
    );
    expect(f.emit).toHaveBeenCalledWith('match:finished', {
      winnerId: 'opponent-id',
    });
  });
  it('disconnecting the match socket forfeits even if another account tab is still online', async () => {
    const f = fixture('RANK', true);
    await f.gateway.handleDisconnect(f.client);
    expect(f.matches.finishRankedMatch).toHaveBeenCalledOnce();
  });
  it('disconnecting an unrelated tab does not forfeit the match tab', async () => {
    const f = fixture('RANK', true);
    delete f.client.data.activeMatchId;
    await f.gateway.handleDisconnect(f.client);
    expect(f.matches.finishRankedMatch).not.toHaveBeenCalled();
  });
  it('Friendly exits use the casual finish path and notify both players', async () => {
    const f = fixture('FRIEND');
    await f.gateway.leaveMatch('user-id', 'match-id');
    expect(f.friendly.leave).toHaveBeenCalledWith('match-id', 'user-id');
    expect(f.matches.finishRankedMatch).not.toHaveBeenCalled();
    expect(f.emit).toHaveBeenCalledWith('friend:match-finished', {
      winnerId: 'opponent-id',
    });
  });
  it('duplicate socket and HTTP leave requests do not finalize twice', async () => {
    const f = fixture();
    await f.gateway.leaveMatch('user-id', 'match-id');
    await f.gateway.leaveMatch('user-id', 'match-id');
    expect(f.matches.finishRankedMatch).toHaveBeenCalledOnce();
  });
  it('validates membership before accepting a leave request', async () => {
    const f = fixture();
    f.rounds.assertMember.mockRejectedValue(new Error('Not a member'));
    await expect(f.gateway.leaveMatch('intruder', 'match-id')).rejects.toThrow(
      'Not a member',
    );
    expect(f.matches.finishRankedMatch).not.toHaveBeenCalled();
  });
});
