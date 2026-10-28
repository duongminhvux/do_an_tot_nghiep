import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { SqlRecords } from '../../../postgres/records.js';
import { sql } from '../../../postgres/sql.js';
import { sampleContentWords } from '../../vocabulary/content-reader.js';

import { Injectable,Optional } from '@nestjs/common';
import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { ArenaSettingsService } from '../admin/arena-settings.service.js';

import { WsException } from '@nestjs/websockets';

import { randomInt,randomUUID } from 'node:crypto';
import { RedisService } from '../../../common/redis/redis.service.js';
import { ArenaService } from '../arena.service.js';
import { ArenaMatchService } from '../matches/arena-match.service.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';
import { ArenaQuestionService } from '../question/arena-question.service.js';
import {
ArenaFriendMode,
ArenaMatchFinishReason,
ArenaMatchStatus,
ArenaMatchType,
ArenaQuestionMode
} from '../rows/arena-match.row.js';
import {
FriendRoom,
FriendRoomSettings,
FriendRoomStatus
} from '../rows/friend-room.row.js';

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
  private get rooms(){return new SqlRecords(this.nativeDb,'friendrooms');}
private get matches(){return new SqlRecords(this.nativeDb,'arenamatches');}
private get users(){return new SqlRecords(this.nativeDb,'identity_profiles');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,private readonly matchService: ArenaMatchService,
private readonly presence: ArenaPresenceService,
private readonly questions: ArenaQuestionService,
private readonly arena: ArenaService,
private readonly redis: RedisService,
@Optional() private readonly settings?: ArenaSettingsService
  ) {}

  id(value: string) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
      throw new WsException('Invalid ID');
    return String(value);
  }
  participants(room: FriendRoom) {
    return [
      String(room.hostId),
      ...(room.maxPlayers > 2
        ? (room.members ?? []).map((m:any) => String(m.userId))
        : room.guestId
          ? [String(room.guestId)]
          : []),
    ];
  }
  isFull(room: FriendRoom) {
    return this.participants(room).length >= (room.maxPlayers ?? 2);
  }
  async active(userId: string) {
    const id=this.id(userId);
    return this.rooms.one(sql`host_id=${id}::uuid OR guest_id=${id}::uuid OR members @> ${JSON.stringify([{userId:id}])}::jsonb`);
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
    const config = this.settings
      ? await this.settings.requireEnabled(maxPlayers ? 'ROOM' : 'FRIEND')
      : ARENA_DEFAULTS;
    if (maxPlayers && maxPlayers > config.group.maxPlayers)
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
          const room = await this.rooms.insert({
            code,
            hostId: this.id(userId),
            mode,
            settings: validated,
            maxPlayers: maxPlayers ?? 2,
            runtimePolicy: {
              reconnectGrace: maxPlayers
                ? config.group.reconnectGrace
                : config.friendly.reconnectGrace,
              idleTimeout: maxPlayers ? config.group.roomIdleTimeout : 1800 },
            members: [] });
          return this.snapshot(String(room._id), userId);
        } catch (e) {
          if ((e as {code?:string}).code !== '23505') throw e;
        }
      }
      throw new WsException('Unable to generate room code');
    });
  }
  async member(roomId: string, userId: string) {
    const room = await this.rooms.one(sql`id=${this.id(roomId)}::uuid`);
    if (!room || room.status === FriendRoomStatus.CLOSED)
      throw new WsException('ROOM_NOT_FOUND');
    if (!this.participants(room).includes(userId))
      throw new WsException('NOT_ROOM_GUEST');
    return room;
  }
  async snapshot(roomId: string, userId: string) {
    const room = await this.member(roomId, userId);
    const users=await this.users.select(sql`id=ANY(${this.participants(room)}::uuid[])`);
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
              ? !!room.members.find((m:any) => String(m.userId) === id)?.isReady
              : id === String(room.guestId) && room.guestReady };
      }),
      serverNow: new Date().toISOString() };
  }
  async join(userId: string, code: string, roomType?: 'FRIEND' | 'ROOM') {
    if (roomType !== undefined && roomType !== 'FRIEND' && roomType !== 'ROOM')
      throw new WsException('INVALID_ROOM_TYPE');
    if (typeof code !== 'string' || !/^[A-Z2-9]{6}$/i.test(code.trim()))
      throw new WsException('ROOM_NOT_FOUND');
    return this.reserve(userId, async () => {
      await this.available(userId);
      const room = await this.rooms.one(sql`("code" = ${code.trim().toUpperCase()})`);
      if (!room) throw new WsException('ROOM_NOT_FOUND');
      if (roomType && (room.maxPlayers > 2 ? 'ROOM' : 'FRIEND') !== roomType)
        throw new WsException('ROOM_TYPE_MISMATCH');
      if (room.status !== FriendRoomStatus.WAITING)
        throw new WsException('ROOM_IN_MATCH');
      if (room.maxPlayers > 2) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const current = await this.rooms.one(sql`id=${room._id}::uuid`);
          if (!current) throw new WsException('ROOM_NOT_FOUND');
          if (current.status !== FriendRoomStatus.WAITING)
            throw new WsException('ROOM_IN_MATCH');
          if (this.isFull(current)) throw new WsException('ROOM_FULL');
          const joined = await this.rooms.patch(sql`("id" = ${current._id}) AND ("status" = ${FriendRoomStatus.WAITING}) AND ("revision" = ${current.revision})`,{
                members: [
                  ...current.members,
                  {
                    userId: this.id(userId),
                    isReady: false,
                    disconnectedAt: null },
                ] },{"revision":sql`COALESCE("revision",0)+${1}`});
          if (joined) return this.snapshot(String(room._id), userId);
        }
        throw new WsException('ROOM_FULL');
      }
      if (room.guestId) throw new WsException('ROOM_FULL');
      const joined = await this.rooms.patch(sql`("id" = ${room._id}) AND ("status" = ${FriendRoomStatus.WAITING}) AND ("guest_id" IS NULL)`,{
            guestId: this.id(userId),
            guestReady: false,
            guestDisconnectedAt: null },{"revision":sql`COALESCE("revision",0)+${1}`});
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
    const changed=await this.rooms.patch(sql`id=${room._id}::uuid AND status=${FriendRoomStatus.WAITING} AND revision=${room.revision}`,{
      mode,maxPlayers:capacity,settings:validated,guestReady:false,
      ...(room.maxPlayers>2?{members:room.members.map((m:any)=>({userId:m.userId,disconnectedAt:m.disconnectedAt,isReady:false}))}:{}),
    },{revision:sql`COALESCE(revision,0)+1`});
    if (!changed) throw new WsException('ROOM_IN_MATCH');
    return this.snapshot(roomId, userId);
  }
  async ready(roomId: string, userId: string, ready: boolean) {
    if (typeof ready !== 'boolean')
      throw new WsException('INVALID_ROOM_SETTINGS');
    const room = await this.member(roomId, userId);
    if (room.maxPlayers > 2) {
      const changed=await this.rooms.patch(sql`id=${room._id}::uuid AND status=${FriendRoomStatus.WAITING} AND members @> ${JSON.stringify([{userId:this.id(userId)}])}::jsonb`,{}, {
        revision:sql`COALESCE(revision,0)+1`,members:sql`(SELECT COALESCE(jsonb_agg(CASE WHEN m->>'userId'=${userId} THEN m||jsonb_build_object('isReady',${ready}::boolean) ELSE m END ORDER BY ordinality),'[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(members,'[]'::jsonb)) WITH ORDINALITY entry(m,ordinality))`,
      });
      if (!changed) throw new WsException('NOT_ROOM_GUEST');
      return this.snapshot(roomId, userId);
    }
    const changed=await this.rooms.patch(sql`id=${this.id(roomId)}::uuid AND guest_id=${this.id(userId)}::uuid AND status=${FriendRoomStatus.WAITING}`,
      {guestReady:ready},{revision:sql`COALESCE(revision,0)+1`});
    if (!changed) throw new WsException('NOT_ROOM_GUEST');
    return this.snapshot(roomId, userId);
  }
  async start(roomId: string, userId: string) {
    const room = await this.member(roomId, userId);
    if (this.settings)
      await this.settings.requireEnabled(
        room.maxPlayers > 2 ? 'ROOM' : 'FRIEND',
      );
    if (String(room.hostId) !== userId) throw new WsException('NOT_ROOM_HOST');
    const userIds = this.participants(room);
    if (
      room.maxPlayers > 2
        ? userIds.length < 3 || room.members.some((m:any) => !m.isReady)
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
    const locked=await this.rooms.patch(sql`id=${room._id}::uuid AND status=${FriendRoomStatus.WAITING} AND revision=${room.revision}
      AND current_match_id IS NULL AND (${room.maxPlayers>2}::boolean OR (guest_id=${room.guestId??null}::uuid AND guest_ready IS TRUE))`,{status:FriendRoomStatus.IN_MATCH});
    if (!locked) throw new WsException('MATCH_ALREADY_STARTED');
    let matchId: string | undefined;
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
          secondsPerQuestion: settings.timePerQuestion },
      );
      matchId = match._id;
      if (room.mode === ArenaFriendMode.WORD_GUESS) {
        const [selected]=await sampleContentWords(this.nativeDb,{count:1,fiveLettersOnly:true});
        if (!selected) throw new WsException('NO_FIVE_LETTER_WORDS');
        await this.matches.patch(sql`("id" = ${match._id}) AND ("status" = ${ArenaMatchStatus.COUNTDOWN})`,{
              wordGuessAnswer: selected.word.toLowerCase(),
              wordGuessAttempts: [],
              wordGuessRevision: 0,
              wordGuessSolvedBy: null });
      }
      if (room.mode === ArenaFriendMode.CLASSIC)
        await this.questions.createRankedQuestions(
          String(match._id),
          settings.questionCount!,
        );
      const now = new Date();
      const attached=await this.rooms.patch(sql`id=${room._id}::uuid AND status=${FriendRoomStatus.IN_MATCH} AND revision=${room.revision}`,
        {currentMatchId:match._id},{matchCount:sql`COALESCE(match_count,0)+1`});
      if (!attached) throw new WsException('ROOM_CLOSED');
      const started=await this.matches.patch(sql`id=${match._id}::uuid AND status=${ArenaMatchStatus.COUNTDOWN}`,{
        status:ArenaMatchStatus.PLAYING,startedAt:now,...(room.mode===ArenaFriendMode.WORD_CHAIN?{
          currentTurnUserId:room.hostId,turnStartedAt:now,turnDeadline:new Date(now.getTime()+settings.turnTime!*1000),
        }:{}),
      });
      if (!started) throw new WsException('ROOM_CLOSED');
      return {
        matchId: String(match._id),
        roomId,
        code: room.code,
        users: userIds };
    } catch (error) {
      if (matchId)
        await this.matches.patch(sql`("id" = ${matchId}) AND ("status"=ANY(${[ArenaMatchStatus.COUNTDOWN, ArenaMatchStatus.WAITING]}::text[]))`,{
              status: ArenaMatchStatus.CANCELLED,
              cancelReason: 'Room start failed' });
      await this.rooms.patch(sql`("id" = ${room._id}) AND ("status" = ${FriendRoomStatus.IN_MATCH}) AND ("revision" = ${room.revision})`,{
            status: FriendRoomStatus.WAITING,
            currentMatchId: null,
            guestReady: false,
            ...(room.maxPlayers > 2
              ? {
                  members: room.members.map((m:any) => ({
                    userId: m.userId,
                    disconnectedAt: m.disconnectedAt,
                    isReady: false })) }
              : {}) },{"revision":sql`COALESCE("revision",0)+${1}`});
      throw error;
    }
  }
  async leave(roomId: string, userId: string) {
    const room = await this.member(roomId, userId);
    if (room.currentMatchId) {
      const match = await this.matches.one(sql`id=${room.currentMatchId}::uuid`);
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
        await this.matches.patch(sql`("id" = ${match._id}) AND ("status" = ${ArenaMatchStatus.COUNTDOWN})`,{
              status: ArenaMatchStatus.CANCELLED,
              cancelReason: 'Player left room' });
    }
    if (String(room.hostId) === userId) {
      const deleted = await this.rooms.remove(sql`("id" = ${room._id})`).then(records=>records[0]??null);
      if (!deleted) throw new WsException('ROOM_IN_MATCH');
      return {
        users: this.participants(deleted),
        event: 'friend-room:closed',
        data: {
          roomId,
          code: room.code,
          hostId: String(room.hostId),
          reason: 'HOST_LEFT' } };
    }
    if (room.maxPlayers > 2) {
      await this.rooms.patch(sql`id=${room._id}::uuid`,{...(!room.currentMatchId?{status:FriendRoomStatus.WAITING}:{})},{
        revision:sql`COALESCE(revision,0)+1`,members:sql`(SELECT COALESCE(jsonb_agg(m ORDER BY ordinality),'[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(members,'[]'::jsonb)) WITH ORDINALITY entry(m,ordinality) WHERE m->>'userId'<>${this.id(userId)})`,
      });
      return {
        users: this.participants(room),
        event: 'friend-room:update',
        data: await this.snapshot(roomId, String(room.hostId)) };
    }
    const changed=await this.rooms.patch(sql`id=${room._id}::uuid AND guest_id=${this.id(userId)}::uuid`,{
      guestId:null,guestReady:false,guestDisconnectedAt:null,status:FriendRoomStatus.WAITING,currentMatchId:null,
    },{revision:sql`COALESCE(revision,0)+1`});
    if (!changed) throw new WsException('ROOM_IN_MATCH');
    return {
      users: [String(room.hostId), userId],
      event: 'friend-room:update',
      data: await this.snapshot(roomId, String(room.hostId)) };
  }
  async adminCloseWaitingRoom(
    roomId: string,
    reason = 'ADMIN_CLOSED',
    expectedUpdatedAt?: Date,
  ) {
    const [room]=await this.rooms.remove(sql`id=${this.id(roomId)}::uuid AND status=${FriendRoomStatus.WAITING} AND current_match_id IS NULL
      AND (${expectedUpdatedAt??null}::timestamptz IS NULL OR updated_at=${expectedUpdatedAt??null})`);
    if (!room) return null;
    return {
      users: this.participants(room),
      event: 'friend-room:closed',
      data: { roomId, code: room.code, hostId: String(room.hostId), reason } };
  }
  async expireBeforeReconnect(userId: string) {
    const room = await this.active(userId);
    if (!room || room.status !== FriendRoomStatus.WAITING) return null;
    const disconnectedAt =
      String(room.hostId) === userId
        ? room.hostDisconnectedAt
        : room.maxPlayers > 2
          ? room.members.find((m:any) => String(m.userId) === userId)
              ?.disconnectedAt
          : room.guestDisconnectedAt;
    if (
      disconnectedAt &&
      Date.now() - disconnectedAt.getTime() >=
        (room.runtimePolicy?.reconnectGrace ?? 20) * 1000
    )
      return this.leave(String(room._id), userId);
    return null;
  }
  async connection(userId: string, connected: boolean) {
    const room = await this.active(userId);
    if (!room) return null;
    const disconnectedAt=connected?null:new Date();
    if(room.maxPlayers>2&&String(room.hostId)!==userId){
      await this.rooms.patch(sql`id=${room._id}::uuid AND members @> ${JSON.stringify([{userId:this.id(userId)}])}::jsonb`,{}, {
        members:sql`(SELECT COALESCE(jsonb_agg(CASE WHEN m->>'userId'=${userId} THEN m||jsonb_build_object('disconnectedAt',${disconnectedAt}::timestamptz) ELSE m END ORDER BY ordinality),'[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(members,'[]'::jsonb)) WITH ORDINALITY entry(m,ordinality))`,
      });
    }else await this.rooms.patch(sql`id=${room._id}::uuid`,{[String(room.hostId)===userId?'hostDisconnectedAt':'guestDisconnectedAt']:disconnectedAt});
    return connected ? this.snapshot(String(room._id), userId) : null;
  }
  async tick() {
    const events: {
      users: string[];
      event: string;
      data: Record<string, unknown>;
    }[] = [];

    for (const room of await this.rooms.select(sql`("status" = ${FriendRoomStatus.WAITING})`)) {
      const deadline = new Date(
        Date.now() - (room.runtimePolicy?.reconnectGrace ?? 20) * 1000,
      );
      if (
        room.updatedAt &&
        room.updatedAt.getTime() +
          (room.runtimePolicy?.idleTimeout ?? 1800) * 1000 <
          Date.now()
      ) {
        const closed = await this.adminCloseWaitingRoom(
          String(room._id),
          'IDLE_TIMEOUT',
          room.updatedAt,
        );
        if (closed) events.push(closed);
        continue;
      }
      for (const [userId, disconnected] of [
        [room.hostId, room.hostDisconnectedAt],
        ...(room.maxPlayers > 2
          ? room.members.map((m:any) => [m.userId, m.disconnectedAt] as const)
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
