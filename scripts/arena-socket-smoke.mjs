// Isolated transport smoke test: production gateway/interceptor/services, in-memory data.
// Run `pnpm --filter api build`, then `node scripts/arena-socket-smoke.mjs`.
import { createRequire } from "node:module";
import { strict as assert } from "node:assert";
const workspaceUrl = new URL("../", import.meta.url);
const load = (specifier) => import(new URL(specifier, workspaceUrl));
const apiRequire = createRequire(
  new URL("./apps/api/package.json", workspaceUrl),
);
const webRequire = createRequire(
  new URL("./apps/web/package.json", workspaceUrl),
);
const { Test } = apiRequire("@nestjs/testing");
const { Types } = apiRequire("mongoose");
const { io } = webRequire("socket.io-client");
const { ArenaGateway } = await load(
  "./apps/api/dist/modules/arena/gateways/arena.gateway.js",
);
const { ArenaPresenceService } = await load(
  "./apps/api/dist/modules/arena/presence/arena-presence.service.js",
);
const { ArenaMatchmakingService } = await load(
  "./apps/api/dist/modules/arena/matchmaking/arena-matchmaking.service.js",
);
const { ArenaFriendlyService } = await load(
  "./apps/api/dist/modules/arena/friendly/arena-friendly.service.js",
);
const { TransformInterceptor } = await load(
  "./apps/api/dist/common/interceptors/transform.interceptor.js",
);
const { ArenaMatchService } = await load(
  "./apps/api/dist/modules/arena/matches/arena-match.service.js",
);
const { ArenaRoundService } = await load(
  "./apps/api/dist/modules/arena/question/arena-round.service.js",
);
const { AuthService } = await load(
  "./apps/api/dist/modules/auth/auth.service.js",
);
const a = "111111111111111111111111",
  b = "222222222222222222222222";
const queue = new Map(),
  locks = new Map(),
  active = new Set(),
  invitations = [];
const redis = {
  async set(key, value) {
    if (locks.has(key)) return null;
    locks.set(key, value);
    return "OK";
  },
  async eval(_script, { keys, arguments: args }) {
    if (keys[0].endsWith(":lock")) {
      if (locks.get(keys[0]) === args[0]) locks.delete(keys[0]);
      return 1;
    }
    if (!queue.has(args[0]) || !queue.has(args[1])) return 0;
    queue.delete(args[0]);
    queue.delete(args[1]);
    return 1;
  },
  async zAdd(_key, { value, score }) {
    queue.set(value, score);
  },
  async zRem(_key, values) {
    let n = 0;
    for (const value of Array.isArray(values) ? values : [values])
      if (queue.delete(value)) n++;
    return n;
  },
  async zScore(_key, id) {
    return queue.get(id) ?? null;
  },
  async zRangeByScore(_key, min, max) {
    return [...queue]
      .filter(([, rating]) => rating >= min && rating <= max)
      .map(([id]) => id);
  },
};
const users = {
  async exists() {
    return true;
  },
  find({ _id }) {
    return {
      select: () => ({
        lean: async () =>
          _id.$in.map((id) => ({
            _id: id,
            username: id === a ? "Smoke A" : "Smoke B",
          })),
      }),
    };
  },
  findById(id) {
    return {
      select: async () => ({
        username: String(id) === a ? "Smoke A" : "Smoke B",
      }),
    };
  },
};
const inviteMatches = (invite, filter) => {
  if (filter._id && String(filter._id) !== String(invite._id)) return false;
  if (
    filter.receiverId &&
    String(filter.receiverId) !== String(invite.receiverId)
  )
    return false;
  if (filter.status && filter.status !== invite.status) return false;
  if (filter.expiresAt?.$gt && invite.expiresAt <= filter.expiresAt.$gt)
    return false;
  if (filter.expiresAt?.$lte && invite.expiresAt > filter.expiresAt.$lte)
    return false;
  return true;
};
const invites = {
  async exists(filter) {
    return invitations.some((invite) => inviteMatches(invite, filter));
  },
  async create(data) {
    const invite = { _id: new Types.ObjectId(), status: "PENDING", ...data };
    invitations.push(invite);
    return invite;
  },
  async find(filter) {
    return invitations.filter((invite) => inviteMatches(invite, filter));
  },
  async findOneAndUpdate(filter, update) {
    const invite = invitations.find((invite) => inviteMatches(invite, filter));
    if (!invite) return null;
    Object.assign(invite, update.$set);
    return invite;
  },
  async updateOne(filter, update) {
    const invite = invitations.find((invite) => inviteMatches(invite, filter));
    if (!invite) return { modifiedCount: 0 };
    Object.assign(invite, update.$set);
    return { modifiedCount: 1 };
  },
};
const matchRecords = new Map();
const matchService = {
  async findActiveMatchForUser(id) {
    return active.has(id)
      ? ([...matchRecords.values()].find(
          (match) => match.status === "PLAYING" && match.players.includes(id),
        ) ?? {})
      : null;
  },
  async createRankedMatch(first, second) {
    active.add(first);
    active.add(second);
    const match = {
      _id: new Types.ObjectId(),
      type: "RANK",
      status: "PLAYING",
      players: [first, second],
    };
    matchRecords.set(String(match._id), match);
    return { match };
  },
  async createFriendMatch(first, second) {
    active.add(first);
    active.add(second);
    return { match: { _id: new Types.ObjectId() } };
  },
  async processLifecycle() {
    return [];
  },
  async markDisconnected() {},
  async getOpponentUserId(matchId, userId) {
    return matchRecords.get(matchId).players.find((id) => id !== userId);
  },
  async finishRankedMatch(matchId, finishReason, winnerId) {
    const match = matchRecords.get(matchId);
    match.status = "FINISHED";
    match.finishReason = finishReason;
    match.winnerId = winnerId;
    for (const id of match.players) active.delete(id);
    return match;
  },
};
const profiles = {
  async getOrCreateProfile() {
    return { rating: 1000 };
  },
};
const rounds = {
  async assertMember(matchId, userId) {
    assert.ok(matchRecords.get(matchId)?.players.includes(userId));
  },
  async snapshot(matchId) {
    const match = matchRecords.get(matchId);
    return [
      {
        event: "match:finished",
        data: {
          matchId,
          winnerId: match.winnerId,
          finishReason: match.finishReason,
        },
      },
    ];
  },
  async tick() {
    return [];
  },
};
const presence = new ArenaPresenceService();
const matchmaking = new ArenaMatchmakingService(
  presence,
  { getClient: () => redis },
  profiles,
  matchService,
  users,
);
const friendly = new ArenaFriendlyService(
  {
    async find() {
      return [];
    },
  },
  invites,
  {},
  users,
  {},
  matchService,
  rounds,
  {},
  presence,
  profiles,
);
const module = await Test.createTestingModule({
  providers: [
    ArenaGateway,
    { provide: ArenaFriendlyService, useValue: friendly },
    { provide: ArenaMatchmakingService, useValue: matchmaking },
    { provide: ArenaMatchService, useValue: matchService },
    { provide: ArenaPresenceService, useValue: presence },
    {
      provide: AuthService,
      useValue: {
        async verifyToken(token) {
          return { _id: token };
        },
      },
    },
    { provide: ArenaRoundService, useValue: rounds },
  ],
}).compile();
const app = module.createNestApplication({ logger: false });
app.useGlobalInterceptors(new TransformInterceptor());
await app.listen(0, "127.0.0.1");
const url = `http://127.0.0.1:${app.getHttpServer().address().port}/arena`;
const clients = [];
const event = (client, name) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off(name, receive);
      reject(new Error(`Timeout: ${name}`));
    }, 4000);
    const receive = (data) => {
      clearTimeout(timeout);
      resolve(data);
    };
    client.once(name, receive);
  });
const connect = async (id) => {
  const client = io(url, {
    autoConnect: false,
    transports: ["websocket"],
    auth: { token: id },
  });
  clients.push(client);
  const ready = event(client, "arena:authenticated");
  client.connect();
  await ready;
  return client;
};
const request = (client, name, data = {}) =>
  new Promise((resolve, reject) =>
    client
      .timeout(4000)
      .emit(name, data, (error, ack) => (error ? reject(error) : resolve(ack))),
  );
try {
  const ca = await connect(a),
    cb = await connect(b),
    extraTab = await connect(a);
  assert.deepEqual(await presence.overview(), { onlineCount: 2 });
  extraTab.disconnect();
  const received = event(cb, "friend:invite-received");
  const sent = await request(ca, "friend:invite", {
    friendId: b,
    mode: "WORD_CHAIN",
  });
  assert.equal(sent.success, true);
  assert.equal((await received).mode, "WORD_CHAIN");
  const declined = event(ca, "friend:invite-declined");
  assert.equal(
    (
      await request(cb, "friend:invite-decline", {
        inviteId: sent.data.inviteId,
      })
    ).success,
    true,
  );
  await declined;
  const expiresA = event(ca, "friend:invite-expired"),
    expiresB = event(cb, "friend:invite-expired");
  const expiresInvite = await request(ca, "friend:invite", {
    friendId: b,
    mode: "CLASSIC",
  });
  invitations.find(
    (invite) => String(invite._id) === expiresInvite.data.inviteId,
  ).expiresAt = new Date(Date.now() - 1);
  await Promise.all([expiresA, expiresB]);
  const acceptReceived = event(cb, "friend:invite-received");
  const acceptInvite = await request(ca, "friend:invite", {
    friendId: b,
    mode: "CLASSIC",
  });
  await acceptReceived;
  const createdA = event(ca, "friend:match-created"),
    createdB = event(cb, "friend:match-created");
  assert.equal(
    (
      await request(cb, "friend:invite-accept", {
        inviteId: acceptInvite.data.inviteId,
      })
    ).success,
    true,
  );
  const [fa, fb] = await Promise.all([createdA, createdB]);
  assert.equal(fa.matchId, fb.matchId);
  assert.equal(fa.mode, "CLASSIC");
  active.clear(); // Isolate the next transport scenario from this mocked match.
  cb.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(await presence.isOnline(b), false);
  assert.deepEqual(await presence.overview(), { onlineCount: 1 });
  const offlineInvite = await request(ca, "friend:invite", {
    friendId: b,
    mode: "CLASSIC",
  });
  assert.equal(offlineInvite.success, false);
  assert.match(offlineInvite.message, /offline/);
  const cb2 = await connect(b);
  queue.set("333333333333333333333333", 1000);
  const foundA = event(ca, "ranked:match-found"),
    foundB = event(cb2, "ranked:match-found");
  const acknowledgements = await Promise.all([
    request(ca, "ranked:join-queue"),
    request(cb2, "ranked:join-queue"),
  ]);
  assert.equal(acknowledgements.filter((ack) => ack.matched).length, 1);
  const [ma, mb] = await Promise.all([foundA, foundB]);
  assert.equal(ma.matchId, mb.matchId);
  assert.equal(queue.size, 0);
  const leftA = event(ca, "match:finished"),
    leftB = event(cb2, "match:finished");
  assert.equal(
    (await request(ca, "match:leave", { matchId: ma.matchId })).success,
    true,
  );
  const [endedA, endedB] = await Promise.all([leftA, leftB]);
  assert.equal(endedA.winnerId, b);
  assert.equal(endedB.finishReason, "PLAYER_LEFT");
  const nextA = event(ca, "ranked:match-found"),
    nextB = event(cb2, "ranked:match-found");
  await Promise.all([
    request(ca, "ranked:join-queue"),
    request(cb2, "ranked:join-queue"),
  ]);
  await Promise.all([nextA, nextB]);
  const disconnectedResult = event(ca, "match:finished");
  cb2.disconnect();
  assert.equal((await disconnectedResult).winnerId, a);
  console.log(
    "PASS: real Socket.IO acknowledgements, Friendly invitations, live presence, Ranked pairing, explicit exit loss and immediate disconnect loss.",
  );
} finally {
  for (const client of clients) client.disconnect();
  await app.close();
}
