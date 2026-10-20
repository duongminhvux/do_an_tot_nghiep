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
const { ArenaFriendRoomService } = await load(
  "./apps/api/dist/modules/arena/friendly/arena-friend-room.service.js",
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
    if (_script.includes("redis.call('get'")) {
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
      select: () => {
        const rows = _id.$in.map((id) => ({
          _id: id,
          username: String(id) === a ? "Smoke A" : "Smoke B",
        }));
        rows.lean = async () => rows;
        return rows;
      },
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
  if (filter.roomId && String(filter.roomId) !== String(invite.roomId))
    return false;
  if (filter.senderId && String(filter.senderId) !== String(invite.senderId))
    return false;
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
  async createMatch(first, second, options) {
    active.add(first);
    active.add(second);
    const ids = [first, second, ...(options.additionalPlayerIds ?? [])];
    ids.forEach((id) => active.add(id));
    const match = {
      _id: new Types.ObjectId(),
      status: "COUNTDOWN",
      hostId: new Types.ObjectId(first),
      players: ids,
      usedWords: [],
      currentWord: "",
      turnCount: 0,
      roomRevision: 0,
      chainPausedAt: null,
      ...options,
    };
    matchRecords.set(String(match._id), match);
    return { match };
  },
  async markReconnected() {},
  async finishMatch(matchId, finishReason, winnerId) {
    const match = await this.finishRankedMatch(matchId, finishReason, winnerId);
    const room = roomRecords.get(String(match.roomId));
    if (room)
      Object.assign(room, {
        status: "WAITING",
        currentMatchId: null,
        guestReady: false,
        revision: room.revision + 1,
      });
    return match;
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
    match.isDraw = !winnerId;
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
  async finishedEvent(matchId) {
    return (await this.snapshot(matchId))[0];
  },
  async tick() {
    return [];
  },
};
const roomRecords = new Map();
const same = (a, b) => (a == null && b == null) || String(a) === String(b);
const fits = (row, filter) =>
  Object.entries(filter).every(([key, value]) => {
    if (key === "members.userId")
      return (row.members ?? []).some((m) => same(m.userId, value));
    if (key === "$or") return value.some((f) => fits(row, f));
    if (
      value &&
      typeof value === "object" &&
      !(value instanceof Types.ObjectId) &&
      !(value instanceof Date)
    ) {
      if ("$in" in value) return value.$in.some((v) => same(row[key], v));
      if ("$ne" in value) return !same(row[key], value.$ne);
      if ("$gt" in value) return row[key] > value.$gt;
      if ("$lte" in value) return row[key] <= value.$lte;
    }
    return same(row[key], value);
  });
const model = (records) => ({
  findById(id) {
    const row = records.get(String(id));
    const copy = row ? { ...row } : null;
    return Object.assign(Promise.resolve(copy), { select: async () => copy });
  },
  async findOne(filter) {
    const row = [...records.values()].find((r) => fits(r, filter));
    return row ? { ...row } : null;
  },
  async find(filter) {
    return [...records.values()]
      .filter((r) => fits(r, filter))
      .map((r) => ({ ...r }));
  },
  async create(values) {
    const row = {
      _id: new Types.ObjectId(),
      guestId: null,
      status: "WAITING",
      guestReady: false,
      currentMatchId: null,
      matchCount: 0,
      revision: 0,
      hostDisconnectedAt: null,
      guestDisconnectedAt: null,
      ...values,
    };
    records.set(String(row._id), row);
    return { ...row };
  },
  async findOneAndUpdate(filter, update) {
    const row = [...records.values()].find((r) => fits(r, filter));
    if (!row) return null;
    for (const [key, value] of Object.entries(update.$set ?? {})) {
      if (key.startsWith("members.$.")) {
        const member = row.members.find((m) =>
          same(m.userId, filter["members.userId"]),
        );
        if (member) member[key.split(".").at(-1)] = value;
      } else row[key] = value;
    }
    if (update.$pull?.members)
      row.members = row.members.filter(
        (m) => !same(m.userId, update.$pull.members.userId),
      );
    for (const [key, value] of Object.entries(update.$inc || {}))
      row[key] = (row[key] || 0) + value;
    for (const [key, value] of Object.entries(update.$push || {}))
      row[key].push(value);
    return { ...row };
  },
  async updateOne(filter, update) {
    return {
      modifiedCount: (await this.findOneAndUpdate(filter, update)) ? 1 : 0,
    };
  },
  async findOneAndDelete(filter) {
    const row = [...records.values()].find((r) => fits(r, filter));
    if (!row) return null;
    records.delete(String(row._id));
    return { ...row };
  },
});
const presence = new ArenaPresenceService();
const matchmaking = new ArenaMatchmakingService(
  presence,
  { getClient: () => redis },
  profiles,
  matchService,
  users,
);
const matchModel = model(matchRecords);
const questions = {
  async createRankedQuestions(id, count) {
    assert.equal(matchRecords.get(id).questionMode, "MEANING_TO_WORD");
    assert.equal(matchRecords.get(id).questionCount, count);
  },
};
const friendRooms = new ArenaFriendRoomService(
  model(roomRecords),
  matchModel,
  users,
  matchService,
  presence,
  questions,
  profiles,
  { getClient: () => redis },
  { aggregate: async () => [{ word: "apple" }] },
);
const friendly = new ArenaFriendlyService(
  matchModel,
  invites,
  {
    async findOne() {
      return { status: "PLAYING" };
    },
    async updateOne() {
      return { modifiedCount: 1 };
    },
    async find({ matchId }) {
      if (!matchId) return [];
      return matchRecords.get(String(matchId)).players.map((id) => ({
        userId: new Types.ObjectId(id),
        isReady: false,
        score: 0,
      }));
    },
  },
  users,
  {
    async exists() {
      return true;
    },
  },
  matchService,
  rounds,
  questions,
  presence,
  profiles,
  friendRooms,
);
const module = await Test.createTestingModule({
  providers: [
    ArenaGateway,
    { provide: ArenaFriendRoomService, useValue: friendRooms },
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
const event = (client, name, matches = () => true) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off(name, receive);
      reject(new Error(`Timeout: ${name}`));
    }, 4000);
    const receive = (data) => {
      if (!matches(data)) return;
      clearTimeout(timeout);
      client.off(name, receive);
      resolve(data);
    };
    client.on(name, receive);
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
  const ca = await connect(a);
  const onlineB = event(ca, "arena:presence-changed", (data) => data.userId === b);
  const cb = await connect(b);
  assert.deepEqual(await onlineB, { userId: b, online: true });
  const extraTab = await connect(a);
  const presenceChanges = [];
  ca.on("arena:presence-changed", (data) => presenceChanges.push(data));
  assert.deepEqual(await presence.overview(), { onlineCount: 2 });
  extraTab.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(await presence.isOnline(a), true);
  assert.ok(!presenceChanges.some((data) => data.userId === a && !data.online));
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
  const acceptedA = event(ca, "friend:invite-accepted"),
    acceptedB = event(cb, "friend:invite-accepted");
  assert.equal(
    (
      await request(cb, "friend:invite-accept", {
        inviteId: acceptInvite.data.inviteId,
      })
    ).success,
    true,
  );
  const [fa, fb] = await Promise.all([acceptedA, acceptedB]);
  assert.equal(fa.roomId, fb.roomId);
  assert.equal(
    matchRecords.size,
    0,
    "Accepting an invitation must not create a match",
  );
  assert.equal(
    (await request(ca, "friend-room:start", { roomId: fa.roomId })).success,
    false,
  );
  assert.equal(
    (
      await request(cb, "friend-room:settings-update", {
        roomId: fa.roomId,
        mode: "CLASSIC",
        settings: {},
      })
    ).success,
    false,
  );
  assert.equal(
    (await request(cb, "friend-room:ready", { roomId: fa.roomId, ready: true }))
      .success,
    true,
  );
  const startsA = event(ca, "friend-room:started"),
    startsB = event(cb, "friend-room:started");
  const starts = await Promise.all([
    request(ca, "friend-room:start", { roomId: fa.roomId }),
    request(ca, "friend-room:start", { roomId: fa.roomId }),
  ]);
  assert.equal(starts.filter((ack) => ack.success).length, 1);
  const [gameA, gameB] = await Promise.all([startsA, startsB]);
  assert.equal(gameA.matchId, gameB.matchId);
  assert.equal(matchRecords.size, 1);
  assert.equal(
    (await request(ca, "friend:join", { matchId: gameA.matchId })).success,
    true,
  );
  const turn = event(cb, "word-chain:turn");
  assert.equal(
    (await request(cb, "friend:join", { matchId: gameA.matchId })).success,
    true,
  );
  assert.equal((await turn).seconds, 20);
  const nextTurn = event(cb, "word-chain:turn");
  assert.equal(
    (
      await request(ca, "word-chain:submit", {
        matchId: gameA.matchId,
        word: "apple",
      })
    ).success,
    true,
  );
  assert.equal((await nextTurn).requiredLetter, "e");
  const invalid = event(cb, "word-chain:invalid");
  await request(cb, "word-chain:submit", {
    matchId: gameA.matchId,
    word: "house",
  });
  assert.equal((await invalid).reason, "INVALID_START_LETTER");
  const beforeRefresh = roomRecords.get(fa.roomId);
  cb.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const refreshedB = await connect(b);
  assert.equal(
    (await request(refreshedB, "friend-room:join", { roomId: fa.roomId })).data
      .roomId,
    fa.roomId,
  );
  assert.equal(roomRecords.get(fa.roomId), beforeRefresh);
  await matchService.finishMatch(gameA.matchId, "TURN_TIMEOUT", a);
  await request(ca, "friend-room:join", { roomId: fa.roomId });
  await request(refreshedB, "friend-room:join", { roomId: fa.roomId });
  assert.equal(
    matchRecords.size,
    1,
    "Returning must not automatically create a rematch",
  );
  const closedB = event(refreshedB, "friend-room:closed");
  assert.equal(
    (await request(ca, "friend-room:leave", { roomId: fa.roomId })).success,
    true,
  );
  assert.deepEqual(await closedB, {
    roomId: fa.roomId,
    code: fa.code,
    hostId: a,
    reason: "HOST_LEFT",
  });
  assert.equal(roomRecords.size, 0);
  assert.equal(matchRecords.get(gameA.matchId).status, "FINISHED");
  assert.equal(
    (await request(refreshedB, "friend-room:join", { roomId: fa.roomId }))
      .success,
    false,
  );
  // Clear only isolated in-memory match data before the ranked transport scenarios.
  active.clear();
  matchRecords.clear();
  // Five-letter game: real socket actions, private feedback, and winner/replay flow.
  const guessRoom = await request(ca, "friend-room:create", {
    mode: "WORD_GUESS",
    settings: {},
  });
  assert.equal(guessRoom.success, true);
  const missingType = await request(refreshedB, "friend-room:join", {
    code: guessRoom.data.code,
  });
  assert.equal(missingType.success, false);
  assert.equal(missingType.message, "INVALID_ROOM_TYPE");
  const wrongGuessType = await request(refreshedB, "friend-room:join", {
    code: guessRoom.data.code,
    roomType: "ROOM",
  });
  assert.equal(wrongGuessType.success, false);
  assert.equal(wrongGuessType.message, "ROOM_TYPE_MISMATCH");
  assert.equal(roomRecords.get(guessRoom.data.roomId).guestId, null);
  await request(refreshedB, "friend-room:join", {
    code: guessRoom.data.code,
    roomType: "FRIEND",
  });
  const wrongExistingType = await request(refreshedB, "friend-room:join", {
    code: guessRoom.data.code,
    roomType: "ROOM",
  });
  assert.equal(wrongExistingType.message, "ROOM_TYPE_MISMATCH");
  await request(refreshedB, "friend-room:ready", {
    roomId: guessRoom.data.roomId,
    ready: true,
  });
  const guessStart = await request(ca, "friend-room:start", {
    roomId: guessRoom.data.roomId,
  });
  assert.equal(guessStart.success, true);
  const guessId = guessStart.data.matchId;
  const firstGuess = await request(ca, "word-guess:submit", {
    matchId: guessId,
    word: "allee",
  });
  assert.equal(firstGuess.success, true);
  assert.deepEqual(firstGuess.data.attempts[0].feedback, [
    "correct",
    "present",
    "absent",
    "absent",
    "correct",
  ]);
  assert.equal("answer" in firstGuess.data, false);
  const privateState = await request(refreshedB, "word-guess:state", {
    matchId: guessId,
  });
  assert.deepEqual(privateState.data.attempts, []);
  assert.equal("answer" in privateState.data, false);
  const solved = await request(refreshedB, "word-guess:submit", {
    matchId: guessId,
    word: "apple",
  });
  assert.equal(solved.success, true);
  assert.equal(solved.data.winnerId, b);
  assert.equal(solved.data.answer, "apple");
  const restored = await request(ca, "word-guess:state", { matchId: guessId });
  assert.equal(restored.data.attempts.length, 1);
  assert.equal(restored.data.answer, "apple");
  const oldGuess = await request(ca, "word-guess:submit", {
    matchId: guessId,
    word: "apple",
  });
  assert.equal(oldGuess.success, false);
  await request(ca, "friend-room:leave", { roomId: guessRoom.data.roomId });
  // Multiplayer lobby uses the production room service and gateway over real sockets.
  for (const capacity of [2, 9, 3.5]) {
    const invalid = await request(ca, "friend-room:create", {
      maxPlayers: capacity,
    });
    assert.equal(invalid.success, false);
    assert.equal(invalid.message, "INVALID_ROOM_CAPACITY");
  }
  const group = await request(ca, "friend-room:create", { maxPlayers: 8 });
  assert.equal(group.success, true);
  assert.equal(group.data.maxPlayers, 8);
  const resizedDown = await request(ca, "friend-room:settings-update", {
    roomId: group.data.roomId,
    mode: "CLASSIC",
    settings: {},
    maxPlayers: 3,
  });
  assert.equal(resizedDown.success, true);
  assert.equal(resizedDown.data.maxPlayers, 3);
  const resizedUp = await request(ca, "friend-room:settings-update", {
    roomId: group.data.roomId,
    mode: "CLASSIC",
    settings: {},
    maxPlayers: 8,
  });
  assert.equal(resizedUp.success, true);
  assert.equal(resizedUp.data.maxPlayers, 8);
  const wrongGroupType = await request(refreshedB, "friend-room:join", {
    code: group.data.code,
    roomType: "FRIEND",
  });
  assert.equal(wrongGroupType.success, false);
  assert.equal(wrongGroupType.message, "ROOM_TYPE_MISMATCH");
  assert.equal(roomRecords.get(group.data.roomId).members.length, 0);
  const groupGuests = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      connect((i + 3).toString(16).repeat(24)),
    ),
  );
  const joins = await Promise.all(
    groupGuests.map((socket) =>
      request(socket, "friend-room:join", {
        code: group.data.code,
        roomType: "ROOM",
      }),
    ),
  );
  assert.equal(joins.filter((ack) => ack.success).length, 7);
  const accepted = groupGuests.filter((_, i) => joins[i].success);
  const tooSmall = await request(ca, "friend-room:settings-update", {
    roomId: group.data.roomId,
    mode: "CLASSIC",
    settings: {},
    maxPlayers: 7,
  });
  assert.equal(tooSmall.success, false);
  assert.equal(tooSmall.message, "ROOM_CAPACITY_TOO_SMALL");
  const guestResize = await request(
    accepted[0],
    "friend-room:settings-update",
    { roomId: group.data.roomId, mode: "CLASSIC", settings: {}, maxPlayers: 8 },
  );
  assert.equal(guestResize.success, false);
  assert.equal(guestResize.message, "NOT_ROOM_HOST");
  const beforeReady = await request(ca, "friend-room:start", {
    roomId: group.data.roomId,
  });
  assert.equal(beforeReady.success, false);
  await Promise.all(
    accepted.map((socket) =>
      request(socket, "friend-room:ready", {
        roomId: group.data.roomId,
        ready: true,
      }),
    ),
  );
  const groupStarted = accepted.map((socket) =>
    event(socket, "friend-room:started"),
  );
  const groupStart = await request(ca, "friend-room:start", {
    roomId: group.data.roomId,
  });
  assert.equal(groupStart.success, true);
  assert.equal(groupStart.data.users.length, 8);
  const startEvents = await Promise.all(groupStarted);
  assert.ok(
    startEvents.every((data) => data.matchId === groupStart.data.matchId),
  );
  assert.equal(matchRecords.get(groupStart.data.matchId).type, "ROOM");
  assert.equal(matchRecords.get(groupStart.data.matchId).players.length, 8);
  await matchService.finishMatch(groupStart.data.matchId, "NORMAL", a);
  const groupClosed = accepted.map((socket) =>
    event(socket, "friend-room:closed"),
  );
  await request(ca, "friend-room:leave", { roomId: group.data.roomId });
  for (const notification of await Promise.all(groupClosed)) {
    assert.deepEqual(notification, {
      roomId: group.data.roomId,
      code: group.data.code,
      hostId: a,
      reason: "HOST_LEFT",
    });
  }
  groupGuests.forEach((socket) => socket.disconnect());
  await new Promise((resolve) => setTimeout(resolve, 50));
  const codeRoom = await request(ca, "friend-room:create", {
    mode: "CLASSIC",
    settings: { questionCount: 15, timePerQuestion: 30 },
  });
  assert.equal(codeRoom.success, true);
  assert.equal(
    (
      await request(refreshedB, "friend-room:join", {
        code: codeRoom.data.code,
        roomType: "FRIEND",
      })
    ).success,
    true,
  );
  const codeClosed = event(refreshedB, "friend-room:closed");
  await request(ca, "friend-room:leave", { roomId: codeRoom.data.roomId });
  assert.deepEqual(await codeClosed, {
    roomId: codeRoom.data.roomId,
    code: codeRoom.data.code,
    hostId: a,
    reason: "HOST_LEFT",
  });
  const offlineB = event(ca, "arena:presence-changed", (data) => data.userId === b);
  refreshedB.disconnect();
  cb.disconnect();
  assert.deepEqual(await offlineB, { userId: b, online: false });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(await presence.isOnline(b), false);
  assert.deepEqual(await presence.overview(), { onlineCount: 1 });
  const offlineInvite = await request(ca, "friend:invite", {
    friendId: b,
    mode: "CLASSIC",
  });
  assert.equal(offlineInvite.success, false);
  assert.match(offlineInvite.message, /offline/);
  const backOnlineB = event(ca, "arena:presence-changed", (data) => data.userId === b);
  const cb2 = await connect(b);
  assert.deepEqual(await backOnlineB, { userId: b, online: true });
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
    "PASS: real Socket.IO room creation, typed code join/cross-type rejection, invitations, permissions, atomic start, Word Chain, five-letter guessing/private feedback, reconnect, return without auto-rematch, host closure, history preservation and Ranked regression scenarios.",
  );
} finally {
  for (const client of clients) client.disconnect();
  await app.close();
}
