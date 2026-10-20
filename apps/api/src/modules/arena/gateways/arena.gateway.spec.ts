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
vi.mock('../friendly/arena-friend-room.service.js', () => ({
  ArenaFriendRoomService: class {},
}));
vi.mock('../schemas/friend-room.schema.js', () => ({}));
vi.mock('../friendly/arena-friendly.service.js', () => ({
  ArenaFriendlyService: class {},
}));

vi.mock('../schemas/arena-match.schema.js', () => ({
  ArenaMatchFinishReason: { PLAYER_LEFT: 'PLAYER_LEFT' },
  ArenaFriendMode: {
    CLASSIC: 'CLASSIC',
    WORD_CHAIN: 'WORD_CHAIN',
    WORD_GUESS: 'WORD_GUESS',
  },
  ArenaMatchType: { RANK: 'RANK', FRIEND: 'FRIEND', ROOM: 'ROOM' },
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
    markReconnected: vi.fn(),
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
    pending: vi.fn().mockResolvedValue([]),
    leaveResult: vi.fn().mockResolvedValue([]),
    member: vi.fn().mockResolvedValue(null),
    returnToLobby: vi
      .fn()
      .mockResolvedValue({ matchId: 'match-id', status: 'FINISHED' }),
    snapshot: vi
      .fn()
      .mockResolvedValue({ matchId: 'match-id', status: 'FINISHED' }),
    gameSnapshot: vi.fn().mockResolvedValue([]),
    leave: vi
      .fn()
      .mockResolvedValue([
        { event: 'friend:match-finished', data: { winnerId: 'opponent-id' } },
      ]),
  };
  const presence = {
    disconnect: vi.fn().mockResolvedValue({ online }),
    connect: vi.fn().mockResolvedValue({ online: true }),
    isOnline: vi.fn().mockResolvedValue(online),
  };
  const auth = { verifyToken: vi.fn().mockResolvedValue({ _id: 'user-id' }) };
  const matchmaking = { leaveQueue: vi.fn() };
  const rooms = {
    connection: vi.fn(),
    expireBeforeReconnect: vi.fn(),
    active: vi.fn().mockResolvedValue(null),
    snapshot: vi.fn(),
    join: vi.fn(),
  };
  const deps = [
    friendly,
    matchmaking,
    matches,
    presence,
    auth,
    rounds,
    rooms,
  ] as unknown as ConstructorParameters<typeof ArenaGateway>;
  const gateway = new ArenaGateway(...deps);
  const emit = vi.fn();
  gateway.server = { to: vi.fn(() => ({ emit })) } as never;
  const client = {
    id: 'socket-id',
    connected: true,
    handshake: { auth: { token: 'valid-token' } },
    emit: vi.fn(),
    disconnect: vi.fn(),
    join: vi.fn(),
    data: { userId: 'user-id', activeMatchId: 'match-id' },
  } as unknown as Socket;
  return { gateway, matches, friendly, rounds, rooms, presence, auth, emit, client };
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

describe('Friendly result and lobby navigation', () => {
  it('notifies the waiting player when a finished result is left via HTTP or socket', async () => {
    const f = fixture('FRIEND');
    f.matches.findActiveMatchForUser.mockResolvedValue(null);
    f.friendly.leaveResult.mockResolvedValue([
      { event: 'friend:snapshot', data: { matchId: 'match-id', players: [] } },
    ] as never);
    await f.gateway.leaveMatch('user-id', 'match-id');
    expect(f.friendly.leaveResult).toHaveBeenCalledWith('match-id', 'user-id');
    expect(f.emit).toHaveBeenCalledWith('friend:snapshot', expect.any(Object));
    expect(f.matches.finishRankedMatch).not.toHaveBeenCalled();
  });

  it('disconnecting a result tab preserves the room when another tab is online', async () => {
    const f = fixture('FRIEND', true);
    f.matches.findActiveMatchForUser.mockResolvedValue(null);
    await f.gateway.handleDisconnect(f.client);
    expect(f.friendly.leaveResult).not.toHaveBeenCalled();
  });

  it('only treats joining the lobby as a return, not reloading the result', async () => {
    const f = fixture('FRIEND');
    Object.assign(f.client, { join: vi.fn(), emit: vi.fn() });
    await f.gateway.joinFriend(f.client, { matchId: 'match-id' });
    expect(f.friendly.returnToLobby).not.toHaveBeenCalled();
    expect(f.friendly.snapshot).toHaveBeenCalledWith('match-id', 'user-id');
    await f.gateway.joinFriend(f.client, {
      matchId: 'match-id',
      returnToLobby: true,
    });
    expect(f.friendly.returnToLobby).toHaveBeenCalledWith(
      'match-id',
      'user-id',
    );
    expect(f.emit).toHaveBeenCalledWith(
      'friend:snapshot',
      expect.objectContaining({ status: 'FINISHED' }),
    );
    expect(f.emit).not.toHaveBeenCalledWith(
      'friend:match-created',
      expect.anything(),
    );
  });
});

describe('Room entry type enforcement', () => {
  it('requires an explicit type for manual code entry', async () => {
    const f = fixture();
    expect(
      await f.gateway.joinFriendRoom(f.client, { code: 'ABC234' }),
    ).toMatchObject({ success: false, message: 'INVALID_ROOM_TYPE' });
    expect(f.rooms.join).not.toHaveBeenCalled();
    expect(f.client.join).not.toHaveBeenCalled();
  });
  it('rejects the wrong type even for an existing member reopening the same code', async () => {
    const f = fixture();
    f.rooms.active.mockResolvedValue({
      _id: 'room-id',
      code: 'ABC234',
      maxPlayers: 8,
    } as never);
    expect(
      await f.gateway.joinFriendRoom(f.client, {
        code: 'abc234',
        roomType: 'FRIEND',
      }),
    ).toMatchObject({ success: false, message: 'ROOM_TYPE_MISMATCH' });
    expect(f.rooms.snapshot).not.toHaveBeenCalled();
    expect(f.rooms.join).not.toHaveBeenCalled();
    expect(f.client.join).not.toHaveBeenCalled();
  });
  it('passes the chosen type into atomic room membership validation', async () => {
    const f = fixture();
    f.rooms.join.mockResolvedValue({
      roomId: 'room-id',
      code: 'ABC234',
      maxPlayers: 8,
      players: [{ userId: 'user-id' }],
    });
    expect(
      await f.gateway.joinFriendRoom(f.client, {
        code: 'ABC234',
        roomType: 'ROOM',
      }),
    ).toMatchObject({ success: true });
    expect(f.rooms.join).toHaveBeenCalledWith('user-id', 'ABC234', 'ROOM');
    expect(f.client.join).toHaveBeenCalledWith('friend-room:room-id');
  });
});


describe('Invitation list live presence', () => {
  it('publishes online status to authenticated observers after connection', async () => {
    const f = fixture('FRIEND');
    await f.gateway.handleConnection(f.client);
    expect(f.auth.verifyToken).toHaveBeenCalledWith('valid-token');
    expect(f.client.join).toHaveBeenCalledWith('arena:presence');
    expect(f.client.emit).toHaveBeenCalledWith('arena:authenticated');
    expect(f.gateway.server.to).toHaveBeenCalledWith('arena:presence');
    expect(f.emit).toHaveBeenCalledWith('arena:presence-changed', {
      userId: 'user-id', online: true,
    });
  });

  it('does not subscribe or announce unauthenticated sockets', async () => {
    const f = fixture('FRIEND');
    f.auth.verifyToken.mockRejectedValue(new Error('Invalid token'));
    await f.gateway.handleConnection(f.client);
    expect(f.client.disconnect).toHaveBeenCalled();
    expect(f.client.join).not.toHaveBeenCalled();
    expect(f.emit).not.toHaveBeenCalled();
  });

  it('publishes offline when the last tab disconnects, then online on reconnect', async () => {
    const f = fixture('FRIEND');
    f.matches.findActiveMatchForUser.mockResolvedValue(null);
    await f.gateway.handleDisconnect(f.client);
    expect(f.emit).toHaveBeenCalledWith('arena:presence-changed', {
      userId: 'user-id', online: false,
    });
    await f.gateway.handleConnection(f.client);
    const changes = f.emit.mock.calls.filter(([event]) => event === 'arena:presence-changed');
    expect(changes.map(([, data]) => data.online)).toEqual([false, true]);
  });

  it('keeps the user online when another account tab remains connected', async () => {
    const f = fixture('FRIEND', true);
    f.matches.findActiveMatchForUser.mockResolvedValue(null);
    await f.gateway.handleDisconnect(f.client);
    expect(f.emit).not.toHaveBeenCalledWith('arena:presence-changed', expect.anything());
  });
});
