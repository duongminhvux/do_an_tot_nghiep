vi.mock('../matches/arena-match.service.js', () => ({
  ArenaMatchService: class {},
}));
import { ArenaMatchmakingService } from './arena-matchmaking.service.js';
vi.mock('../../users/schema/user.schema.js', () => ({ User: class {} }));

function fixture() {
  const queue = new Map<string, number>();
  const locks = new Map<string, string>();
  const online = new Set(['a', 'b', 'c']);
  const active = new Set<string>();
  const redis = {
    set: vi.fn(async (key: string, token: string) => {
      if (locks.has(key)) return null;
      locks.set(key, token);
      return 'OK';
    }),
    eval: vi.fn(
      async (
        _script: string,
        options: { keys: string[]; arguments: string[] },
      ) => {
        if (options.keys[0]!.endsWith(':lock')) {
          if (locks.get(options.keys[0]!) === options.arguments[0])
            locks.delete(options.keys[0]!);
          return 1;
        }
        const [a, b] = options.arguments;
        if (!queue.has(a!) || !queue.has(b!)) return 0;
        queue.delete(a!);
        queue.delete(b!);
        return 1;
      },
    ),
    zAdd: vi.fn(
      async (_key: string, entry: { score: number; value: string }) => {
        queue.set(entry.value, entry.score);
      },
    ),
    zRem: vi.fn(async (_key: string, values: string | string[]) => {
      let removed = 0;
      for (const value of Array.isArray(values) ? values : [values])
        if (queue.delete(value)) removed++;
      return removed;
    }),
    zScore: vi.fn(
      async (_key: string, value: string) => queue.get(value) ?? null,
    ),
    zRangeByScore: vi.fn(async (_key: string, min: number, max: number) =>
      [...queue]
        .filter(([, rating]) => rating >= min && rating <= max)
        .map(([id]) => id),
    ),
  };
  const presence = { isOnline: vi.fn(async (id: string) => online.has(id)) };
  const profiles = {
    getOrCreateProfile: vi.fn(async () => ({ rating: 1000 })),
  };
  const matches = {
    findActiveMatchForUser: vi.fn(async (id: string) =>
      active.has(id) ? {} : null,
    ),
    createRankedMatch: vi.fn(async (a: string, b: string) => {
      active.add(a);
      active.add(b);
      return { match: { _id: 'match-1' } };
    }),
  };
  const users = {
    find: vi.fn((filter: { _id: { $in: string[] } }) => ({
      select: () => ({
        lean: async () =>
          filter._id.$in.map((id) => ({ _id: id, username: id })),
      }),
    })),
  };
  const deps = [
    presence,
    { getClient: () => redis },
    profiles,
    matches,
    users,
  ] as unknown as ConstructorParameters<typeof ArenaMatchmakingService>;
  return {
    service: new ArenaMatchmakingService(...deps),
    queue,
    online,
    matches,
    locks,
    redis,
    active,
  };
}

describe('Ranked matchmaking', () => {
  it('waits when only the current player is online', async () => {
    const f = fixture();
    f.online.delete('b');
    f.online.delete('c');
    expect(await f.service.joinQueue('a')).toMatchObject({
      matched: false,
      status: 'WAITING',
    });
    expect(f.matches.createRankedMatch).not.toHaveBeenCalled();
  });
  it('removes stale offline queue entries before searching for an opponent', async () => {
    const f = fixture();
    f.queue.set('ghost', 1000);
    expect(await f.service.joinQueue('a')).toMatchObject({ matched: false });
    expect(f.queue.has('ghost')).toBe(false);
  });
  it('skips queued users who already have another active match', async () => {
    const f = fixture();
    f.queue.set('b', 1000);
    f.active.add('b');
    expect(await f.service.joinQueue('a')).toMatchObject({ matched: false });
    expect(f.queue.has('b')).toBe(false);
  });
  it('creates exactly one match when two players join simultaneously', async () => {
    const f = fixture();
    const results = await Promise.all([
      f.service.joinQueue('a'),
      f.service.joinQueue('b'),
    ]);
    expect(results.filter((result) => result.matched)).toHaveLength(1);
    expect(f.matches.createRankedMatch).toHaveBeenCalledTimes(1);
    expect(f.queue.size).toBe(0);
    expect(f.locks.size).toBe(0);
  });
  it('never pairs a player with themselves', async () => {
    const f = fixture();
    await f.service.joinQueue('a');
    await f.service.joinQueue('a');
    expect(f.matches.createRankedMatch).not.toHaveBeenCalled();
  });
  it('rejects disconnected queue requests and releases its lock', async () => {
    const f = fixture();
    f.online.delete('a');
    await expect(f.service.joinQueue('a')).rejects.toThrow('connected');
    expect(f.locks.size).toBe(0);
  });
});
