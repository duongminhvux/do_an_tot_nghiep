import { Word } from '../../vocabulary/words/word.schema.js';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WsException } from '@nestjs/websockets';
import { Model, Types } from 'mongoose';
import { randomInt, randomUUID } from 'node:crypto';
import {
  FriendRoom,
  FriendRoomSettings,
  FriendRoomStatus,
} from '../schemas/friend-room.schema.js';
import {
  ArenaFriendMode,
  ArenaMatch,
  ArenaMatchStatus,
  ArenaMatchFinishReason,
  ArenaMatchType,
  ArenaQuestionMode,
} from '../schemas/arena-match.schema.js';
import { User } from '../../users/schema/user.schema.js';
import { ArenaMatchService } from '../matches/arena-match.service.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';
import { ArenaQuestionService } from '../question/arena-question.service.js';
import { ArenaService } from '../arena.service.js';
import { RedisService } from '../../../common/redis/redis.service.js';

export function validateFriendSettings(
  mode: ArenaFriendMode,
  settings: FriendRoomSettings = {},
): FriendRoomSettings {
  if (
    !settings ||
    typeof settings !== 'object' ||
    Array.isArray(settings) ||
    Object.entries(settings).some(
      ([key, value]) =>
        !['questionCount', 'timePerQuestion', 'turnTime'].includes(key) ||
        typeof value !== 'number',
    )
  )
    throw new WsException('INVALID_ROOM_SETTINGS');
  if (mode === ArenaFriendMode.WORD_GUESS) {
    if (Object.keys(settings).length)
      throw new WsException('INVALID_ROOM_SETTINGS');
    return {};
  }
  const seconds = (value: number) =>
    Number.isInteger(value) && [10, 15, 20, 30].includes(value);
  if (mode === ArenaFriendMode.CLASSIC) {
    const questionCount = settings.questionCount ?? 10;
    const timePerQuestion = settings.timePerQuestion ?? 15;
    if (
      !Number.isInteger(questionCount) ||
      questionCount < 5 ||
      questionCount > 30 ||
      !seconds(timePerQuestion) ||
      settings.turnTime !== undefined
    )
      throw new WsException('INVALID_ROOM_SETTINGS');
    return { questionCount, timePerQuestion };
  }
  if (
    mode !== ArenaFriendMode.WORD_CHAIN ||
    settings.questionCount !== undefined ||
    settings.timePerQuestion !== undefined ||
    !seconds(settings.turnTime ?? 20)
  )
    throw new WsException('INVALID_ROOM_SETTINGS');
  return { turnTime: settings.turnTime ?? 20 };
}

@Injectable()
export class ArenaFriendRoomService {
  constructor(
    @InjectModel(FriendRoom.name) readonly rooms: Model<FriendRoom>,
    @InjectModel(ArenaMatch.name) private readonly matches: Model<ArenaMatch>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly matchService: ArenaMatchService,
    private readonly presence: ArenaPresenceService,
    private readonly questions: ArenaQuestionService,
    private readonly arena: ArenaService,
    private readonly redis: RedisService,
    @InjectModel(Word.name) private readonly words: Model<Word>,
  ) {}

  id(value: string) {
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
      throw new WsException('Invalid ID');
    return new Types.ObjectId(value);
  }
  participants(room: FriendRoom) {
    return [
      String(room.hostId),
      ...(room.maxPlayers > 2
        ? (room.members ?? []).map((m) => String(m.userId))
        : room.guestId
          ? [String(room.guestId)]
          : []),
    ];
  }
  isFull(room: FriendRoom) {
    return this.participants(room).length >= (room.maxPlayers ?? 2);
  }
  async active(userId: string) {
    return this.rooms.findOne({
      $or: [
        { hostId: this.id(userId) },
        { guestId: this.id(userId) },
        { 'members.userId': this.id(userId) },
      ],
    });
  }
  // Use the same per-user reservation as match creation to exclude concurrent joins/ranked starts.
  private async reserve<T>(userId: string, action: () => Promise<T>) {
    const client = this.redis.getClient();
    const key = `arena:create-match:${userId}`;
    const token = randomUUID();
    if (!(await client.set(key, token, { NX: true, PX: 30000 })))
      throw new WsException('ALREADY_IN_MATCH');
    try {
      return await action();
    } finally {
      await client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        { keys: [key], arguments: [token] },
      );
    }
  }
  async available(userId: string) {
    if (await this.active(userId)) throw new WsException('ALREADY_IN_ROOM');
    if (await this.matchService.findActiveMatchForUser(userId))
      throw new WsException('ALREADY_IN_MATCH');
  }
  async create(
    userId: string,
    mode = ArenaFriendMode.CLASSIC,
    settings: FriendRoomSettings = {},
    maxPlayers?: number,
  ) {
    if (
      maxPlayers !== undefined &&
      (!Number.isInteger(maxPlayers) || maxPlayers < 3 || maxPlayers > 8)
    )
      throw new WsException('INVALID_ROOM_CAPACITY');
    const validated = validateFriendSettings(mode, settings);
    return this.reserve(userId, async () => {
      await this.available(userId);
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = Array.from(
          { length: 6 },
          () => chars[randomInt(chars.length)],
        ).join('');
        try {
          const room = await this.rooms.create({
            code,
            hostId: this.id(userId),
            mode,
            settings: validated,
            maxPlayers: maxPlayers ?? 2,
            members: [],
          });
          return this.snapshot(String(room._id), userId);
        } catch (e) {
          if ((e as { code?: number }).code !== 11000) throw e;
        }
      }
      throw new WsException('Unable to generate room code');
    });
  }
  async member(roomId: string, userId: string) {
    const room = await this.rooms.findById(this.id(roomId));
    if (!room || room.status === FriendRoomStatus.CLOSED)
      throw new WsException('ROOM_NOT_FOUND');
    if (!this.participants(room).includes(userId))
      throw new WsException('NOT_ROOM_GUEST');
    return room;
  }
  async snapshot(roomId: string, userId: string) {
    const room = await this.member(roomId, userId);
    const users = await this.users
      .find({ _id: { $in: this.participants(room).map((id) => this.id(id)) } })
      .select('username avatarUrl');
    return {
      roomId: String(room._id),
      code: room.code,
      hostId: String(room.hostId),
      guestId: room.guestId ? String(room.guestId) : null,
      status: room.status,
      mode: room.mode,
      settings: room.settings,
      guestReady: room.guestReady,
      maxPlayers: room.maxPlayers ?? 2,
      currentMatchId: room.currentMatchId ? String(room.currentMatchId) : null,
      matchCount: room.matchCount,
      players: this.participants(room).map((id) => {
        const u = users.find((entry) => String(entry._id) === id);
        return {
          userId: id,
          username: u?.username || 'Player',
          avatarUrl: u?.avatarUrl,
          isReady:
            room.maxPlayers > 2
              ? !!room.members.find((m) => String(m.userId) === id)?.isReady
              : id === String(room.guestId) && room.guestReady,
        };
      }),
      serverNow: new Date().toISOString(),
    };
  }
  async join(userId: string, code: string, roomType?: 'FRIEND' | 'ROOM') {
    if (roomType !== undefined && roomType !== 'FRIEND' && roomType !== 'ROOM')
      throw new WsException('INVALID_ROOM_TYPE');
    if (typeof code !== 'string' || !/^[A-Z2-9]{6}$/i.test(code.trim()))
      throw new WsException('ROOM_NOT_FOUND');
    return this.reserve(userId, async () => {
      await this.available(userId);
      const room = await this.rooms.findOne({
        code: code.trim().toUpperCase(),
      });
      if (!room) throw new WsException('ROOM_NOT_FOUND');
      if (roomType && (room.maxPlayers > 2 ? 'ROOM' : 'FRIEND') !== roomType)
        throw new WsException('ROOM_TYPE_MISMATCH');
      if (room.status !== FriendRoomStatus.WAITING)
        throw new WsException('ROOM_IN_MATCH');
      if (room.maxPlayers > 2) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const current = await this.rooms.findById(room._id);
          if (!current) throw new WsException('ROOM_NOT_FOUND');
          if (current.status !== FriendRoomStatus.WAITING)
            throw new WsException('ROOM_IN_MATCH');
          if (this.isFull(current)) throw new WsException('ROOM_FULL');
          const joined = await this.rooms.findOneAndUpdate(
            {
              _id: current._id,
              status: FriendRoomStatus.WAITING,
              revision: current.revision,
            },
            {
              $set: {
                members: [
                  ...current.members,
                  {
                    userId: this.id(userId),
                    isReady: false,
                    disconnectedAt: null,
                  },
                ],
              },
              $inc: { revision: 1 },
            },
            { returnDocument: 'after' },
          );
          if (joined) return this.snapshot(String(room._id), userId);
        }
        throw new WsException('ROOM_FULL');
      }
      if (room.guestId) throw new WsException('ROOM_FULL');
      const joined = await this.rooms.findOneAndUpdate(
        { _id: room._id, status: FriendRoomStatus.WAITING, guestId: null },
        {
          $set: {
            guestId: this.id(userId),
            guestReady: false,
            guestDisconnectedAt: null,
          },
          $inc: { revision: 1 },
        },
        { returnDocument: 'after' },
      );
      if (!joined) throw new WsException('ROOM_FULL');
      return this.snapshot(String(room._id), userId);
    });
  }
  async update(
    roomId: string,
    userId: string,
    mode: ArenaFriendMode,
    settings: FriendRoomSettings,
    maxPlayers?: number,
  ) {
    const room = await this.member(roomId, userId);
    if (String(room.hostId) !== userId) throw new WsException('NOT_ROOM_HOST');
    const validated = validateFriendSettings(mode, settings);
    if (room.status !== FriendRoomStatus.WAITING)
      throw new WsException('ROOM_IN_MATCH');
    if (
      maxPlayers !== undefined &&
      ((room.maxPlayers ?? 2) <= 2 ||
        !Number.isInteger(maxPlayers) ||
        maxPlayers < 3 ||
        maxPlayers > 8)
    )
      throw new WsException('INVALID_ROOM_CAPACITY');
    const capacity = maxPlayers ?? room.maxPlayers ?? 2;
    if (capacity < this.participants(room).length)
      throw new WsException('ROOM_CAPACITY_TOO_SMALL');
    if (
      capacity === (room.maxPlayers ?? 2) &&
      room.mode === mode &&
      JSON.stringify(room.settings) === JSON.stringify(validated)
    )
      return this.snapshot(roomId, userId);
    const changed = await this.rooms.updateOne(
      {
        _id: room._id,
        status: FriendRoomStatus.WAITING,
        revision: room.revision,
      },
      {
        $set: {
          mode,
          maxPlayers: capacity,
          settings: validated,
          guestReady: false,
          ...(room.maxPlayers > 2
            ? {
                members: room.members.map((m) => ({
                  userId: m.userId,
                  disconnectedAt: m.disconnectedAt,
                  isReady: false,
                })),
              }
            : {}),
        },
        $inc: { revision: 1 },
      },
    );
    if (!changed.modifiedCount) throw new WsException('ROOM_IN_MATCH');
    return this.snapshot(roomId, userId);
  }
  async ready(roomId: string, userId: string, ready: boolean) {
    if (typeof ready !== 'boolean')
      throw new WsException('INVALID_ROOM_SETTINGS');
    const room = await this.member(roomId, userId);
    if (room.maxPlayers > 2) {
      const changed = await this.rooms.updateOne(
        {
          _id: room._id,
          status: FriendRoomStatus.WAITING,
          'members.userId': this.id(userId),
        },
        { $set: { 'members.$.isReady': ready }, $inc: { revision: 1 } },
      );
      if (!changed.modifiedCount) throw new WsException('NOT_ROOM_GUEST');
      return this.snapshot(roomId, userId);
    }
    const changed = await this.rooms.updateOne(
      {
        _id: this.id(roomId),
        guestId: this.id(userId),
        status: FriendRoomStatus.WAITING,
      },
      { $set: { guestReady: ready }, $inc: { revision: 1 } },
    );
    if (!changed.modifiedCount) throw new WsException('NOT_ROOM_GUEST');
    return this.snapshot(roomId, userId);
  }
  async start(roomId: string, userId: string) {
    const room = await this.member(roomId, userId);
    if (String(room.hostId) !== userId) throw new WsException('NOT_ROOM_HOST');
    const userIds = this.participants(room);
    if (
      room.maxPlayers > 2
        ? userIds.length < 3 || room.members.some((m) => !m.isReady)
        : !room.guestId || !room.guestReady
    )
      throw new WsException('GUEST_NOT_READY');
    const settings = validateFriendSettings(room.mode, room.settings);
    if (
      (await Promise.all(userIds.map((id) => this.presence.isOnline(id)))).some(
        (online) => !online,
      )
    )
      throw new WsException('Player is offline');
    const locked = await this.rooms.findOneAndUpdate(
      {
        _id: room._id,
        status: FriendRoomStatus.WAITING,
        revision: room.revision,
        ...(room.maxPlayers > 2
          ? {}
          : { guestId: room.guestId, guestReady: true }),
        currentMatchId: null,
      },
      { $set: { status: FriendRoomStatus.IN_MATCH } },
      { returnDocument: 'after' },
    );
    if (!locked) throw new WsException('MATCH_ALREADY_STARTED');
    let matchId: Types.ObjectId | undefined;
    try {
      await Promise.all(userIds.map((id) => this.arena.getOrCreateProfile(id)));
      const { match } = await this.matchService.createMatch(
        userId,
        userIds[1]!,
        {
          type:
            room.maxPlayers > 2 ? ArenaMatchType.ROOM : ArenaMatchType.FRIEND,
          ...(room.maxPlayers > 2
            ? { additionalPlayerIds: userIds.slice(2) }
            : {}),
          friendMode: room.mode,
          roomId: room._id,
          roomCodeSnapshot: room.code,
          settingsSnapshot: settings,
          questionMode:
            room.mode === ArenaFriendMode.CLASSIC
              ? ArenaQuestionMode.MEANING_TO_WORD
              : null,
          questionCount: settings.questionCount,
          secondsPerQuestion: settings.timePerQuestion,
        },
      );
      matchId = match._id;
      if (room.mode === ArenaFriendMode.WORD_GUESS) {
        const [selected] = await this.words.aggregate<{ word: string }>([
          {
            $match: {
              word: { $regex: '^[a-zA-Z]{5}$' },
              isActive: true,
              isDeleted: { $ne: true },
            },
          },
          { $sample: { size: 1 } },
          { $project: { word: 1 } },
        ]);
        if (!selected) throw new WsException('NO_FIVE_LETTER_WORDS');
        await this.matches.updateOne(
          { _id: match._id, status: ArenaMatchStatus.COUNTDOWN },
          {
            $set: {
              wordGuessAnswer: selected.word.toLowerCase(),
              wordGuessAttempts: [],
              wordGuessRevision: 0,
              wordGuessSolvedBy: null,
            },
          },
        );
      }
      if (room.mode === ArenaFriendMode.CLASSIC)
        await this.questions.createRankedQuestions(
          String(match._id),
          settings.questionCount!,
        );
      const now = new Date();
      const attached = await this.rooms.updateOne(
        {
          _id: room._id,
          status: FriendRoomStatus.IN_MATCH,
          revision: room.revision,
        },
        { $set: { currentMatchId: match._id }, $inc: { matchCount: 1 } },
      );
      if (!attached.modifiedCount) throw new WsException('ROOM_CLOSED');
      const started = await this.matches.updateOne(
        { _id: match._id, status: ArenaMatchStatus.COUNTDOWN },
        {
          $set: {
            status: ArenaMatchStatus.PLAYING,
            startedAt: now,
            ...(room.mode === ArenaFriendMode.WORD_CHAIN
              ? {
                  currentTurnUserId: room.hostId,
                  turnStartedAt: now,
                  turnDeadline: new Date(
                    now.getTime() + settings.turnTime! * 1000,
                  ),
                }
              : {}),
          },
        },
      );
      if (!started.modifiedCount) throw new WsException('ROOM_CLOSED');
      return {
        matchId: String(match._id),
        roomId,
        code: room.code,
        users: userIds,
      };
    } catch (error) {
      if (matchId)
        await this.matches.updateOne(
          {
            _id: matchId,
            status: {
              $in: [ArenaMatchStatus.COUNTDOWN, ArenaMatchStatus.WAITING],
            },
          },
          {
            $set: {
              status: ArenaMatchStatus.CANCELLED,
              cancelReason: 'Room start failed',
            },
          },
        );
      await this.rooms.updateOne(
        {
          _id: room._id,
          status: FriendRoomStatus.IN_MATCH,
          revision: room.revision,
        },
        {
          $set: {
            status: FriendRoomStatus.WAITING,
            currentMatchId: null,
            guestReady: false,
            ...(room.maxPlayers > 2
              ? {
                  members: room.members.map((m) => ({
                    userId: m.userId,
                    disconnectedAt: m.disconnectedAt,
                    isReady: false,
                  })),
                }
              : {}),
          },
          $inc: { revision: 1 },
        },
      );
      throw error;
    }
  }
  async leave(roomId: string, userId: string) {
    const room = await this.member(roomId, userId);
    if (room.currentMatchId) {
      const match = await this.matches.findById(room.currentMatchId);
      if (
        match?.status === ArenaMatchStatus.PLAYING &&
        match.type === ArenaMatchType.ROOM
      )
        await this.matchService.dropRoomPlayer(
          String(match._id),
          userId,
          ArenaMatchFinishReason.PLAYER_LEFT,
        );
      else if (match?.status === ArenaMatchStatus.PLAYING)
        await this.matchService.finishMatch(
          String(match._id),
          ArenaMatchFinishReason.PLAYER_LEFT,
          (await this.matchService.getOpponentUserId(
            String(match._id),
            userId,
          )) ?? undefined,
        );
      if (
        match?.type === ArenaMatchType.ROOM &&
        String(room.hostId) === userId &&
        match.status === ArenaMatchStatus.PLAYING
      )
        await this.matchService.finishMatch(
          String(match._id),
          ArenaMatchFinishReason.PLAYER_LEFT,
        );
      else if (match?.status === ArenaMatchStatus.COUNTDOWN)
        await this.matches.updateOne(
          { _id: match._id, status: ArenaMatchStatus.COUNTDOWN },
          {
            $set: {
              status: ArenaMatchStatus.CANCELLED,
              cancelReason: 'Player left room',
            },
          },
        );
    }
    if (String(room.hostId) === userId) {
      const deleted = await this.rooms.findOneAndDelete({ _id: room._id });
      if (!deleted) throw new WsException('ROOM_IN_MATCH');
      return {
        users: this.participants(deleted),
        event: 'friend-room:closed',
        data: {
          roomId,
          code: room.code,
          hostId: String(room.hostId),
          reason: 'HOST_LEFT',
        },
      };
    }
    if (room.maxPlayers > 2) {
      await this.rooms.updateOne(
        { _id: room._id },
        {
          $pull: { members: { userId: this.id(userId) } },
          $inc: { revision: 1 },
          ...(!room.currentMatchId
            ? { $set: { status: FriendRoomStatus.WAITING } }
            : {}),
        },
      );
      return {
        users: this.participants(room),
        event: 'friend-room:update',
        data: await this.snapshot(roomId, String(room.hostId)),
      };
    }
    const changed = await this.rooms.updateOne(
      { _id: room._id, guestId: this.id(userId) },
      {
        $set: {
          guestId: null,
          guestReady: false,
          guestDisconnectedAt: null,
          status: FriendRoomStatus.WAITING,
          currentMatchId: null,
        },
        $inc: { revision: 1 },
      },
    );
    if (!changed.modifiedCount) throw new WsException('ROOM_IN_MATCH');
    return {
      users: [String(room.hostId), userId],
      event: 'friend-room:update',
      data: await this.snapshot(roomId, String(room.hostId)),
    };
  }
  async expireBeforeReconnect(userId: string) {
    const room = await this.active(userId);
    if (!room || room.status !== FriendRoomStatus.WAITING) return null;
    const disconnectedAt =
      String(room.hostId) === userId
        ? room.hostDisconnectedAt
        : room.maxPlayers > 2
          ? room.members.find((m) => String(m.userId) === userId)
              ?.disconnectedAt
          : room.guestDisconnectedAt;
    if (disconnectedAt && Date.now() - disconnectedAt.getTime() >= 20000)
      return this.leave(String(room._id), userId);
    return null;
  }
  async connection(userId: string, connected: boolean) {
    const room = await this.active(userId);
    if (!room) return null;
    const field =
      room.maxPlayers > 2 && String(room.hostId) !== userId
        ? 'members.$.disconnectedAt'
        : String(room.hostId) === userId
          ? 'hostDisconnectedAt'
          : 'guestDisconnectedAt';
    await this.rooms.updateOne(
      {
        _id: room._id,
        ...(field.startsWith('members.')
          ? { 'members.userId': this.id(userId) }
          : {}),
      },
      { $set: { [field]: connected ? null : new Date() } },
    );
    return connected ? this.snapshot(String(room._id), userId) : null;
  }
  async tick() {
    const events: {
      users: string[];
      event: string;
      data: Record<string, unknown>;
    }[] = [];
    const deadline = new Date(Date.now() - 20000);
    for (const room of await this.rooms.find({
      status: FriendRoomStatus.WAITING,
    })) {
      for (const [userId, disconnected] of [
        [room.hostId, room.hostDisconnectedAt],
        ...(room.maxPlayers > 2
          ? room.members.map((m) => [m.userId, m.disconnectedAt] as const)
          : [[room.guestId, room.guestDisconnectedAt] as const]),
      ] as const) {
        if (
          !userId ||
          !disconnected ||
          disconnected > deadline ||
          (await this.presence.isOnline(String(userId)))
        )
          continue;
        try {
          events.push(await this.leave(String(room._id), String(userId)));
        } catch (e) {
          if (!(e instanceof WsException)) throw e;
        }
        if (String(userId) === String(room.hostId)) break;
      }
    }
    return events;
  }
}
