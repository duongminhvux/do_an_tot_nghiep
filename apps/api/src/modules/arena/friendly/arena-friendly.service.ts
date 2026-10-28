import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { SqlRecords } from '../../../postgres/records.js';
import { sql } from '../../../postgres/sql.js';
import { contentRows } from '../../vocabulary/content-reader.js';

import { Injectable,Optional } from '@nestjs/common';
import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { ArenaSettingsService } from '../admin/arena-settings.service.js';
import { ArenaFriendRoomService } from './arena-friend-room.service.js';
import { gradeWordGuess } from './word-guess.utils.js';

import { WsException } from '@nestjs/websockets';

import { ArenaService } from '../arena.service.js';
import { ArenaMatchService } from '../matches/arena-match.service.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';
import { ArenaQuestionService } from '../question/arena-question.service.js';
import {
ArenaRoundEvent,
ArenaRoundService
} from '../question/arena-round.service.js';
import { ArenaInvitation } from '../rows/arena-invitation.row.js';
import {
ArenaFriendMode,
ArenaMatchFinishReason,
ArenaMatchStatus,
ArenaMatchType
} from '../rows/arena-match.row.js';

export type FriendlyDelivery = {
  users?: string[];
  matchId?: string;
  event: string;
  data: Record<string, unknown>;
};

@Injectable()
export class ArenaFriendlyService {
  private get matches(){return new SqlRecords(this.nativeDb,'arenamatches');}
private get invites(){return new SqlRecords(this.nativeDb,'arenainvitations');}
private get players(){return new SqlRecords(this.nativeDb,'arenamatchplayers');}
private get users(){return new SqlRecords(this.nativeDb,'identity_profiles');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,private readonly matchService: ArenaMatchService,
private readonly rounds: ArenaRoundService,
private readonly questions: ArenaQuestionService,
private readonly presence: ArenaPresenceService,
private readonly arena: ArenaService,
private readonly friendRooms: ArenaFriendRoomService,
@Optional() private readonly settings?: ArenaSettingsService
  ) {}

  private id(value: string) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
      throw new WsException('Invalid ID');
    return String(value);
  }

  private mode(value: ArenaFriendMode) {
    if (!Object.values(ArenaFriendMode).includes(value))
      throw new WsException('Invalid Friendly mode');
    return value;
  }

  async member(matchId: string, userId: string) {
    await this.rounds.assertMember(matchId, userId);
    const match = await this.matches.one(sql`id=${this.id(matchId)}::uuid`);
    if (
      !match ||
      (match.type !== ArenaMatchType.FRIEND &&
        match.type !== ArenaMatchType.ROOM)
    )
      throw new WsException('Friendly match not found');
    return match;
  }

  async candidates(userId: string, search = '') {
    this.id(userId);
    const history = await this.players.select(sql`("user_id" = ${this.id(userId)}) AND ("status" = ${'FINISHED'})`, sql`ORDER BY "finished_at" DESC NULLS LAST LIMIT ${30}`);
    const opponents = await this.players.select(sql`("match_id"=ANY(${history.map((p:any) => p.matchId)}::uuid[])) AND ("user_id" IS DISTINCT FROM ${this.id(userId)})`);
    const recent = new Set(opponents.map((p:any) => String(p.userId)));
    // The application has no social friendship model yet; only return previous opponents.
    const escaped = String(search)
      .slice(0, 80)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users=await this.users.select(sql`id<>${this.id(userId)}::uuid AND is_deleted IS NOT TRUE AND is_banned IS NOT TRUE
      AND (${String(search).slice(0,80)}::text='' OR username ILIKE '%'||${String(search).slice(0,80)}||'%')`,sql`LIMIT 100`);
    const entries = await Promise.all(
      users.map(async (user) => ({
        userId: String(user._id),
        username: user.username || 'Player',
        avatarUrl: user.avatarUrl,
        online: await this.presence.isOnline(String(user._id)),
        recent: recent.has(String(user._id)) })),
    );
    return entries.filter(
      (user) => user.recent && user.userId !== String(userId),
    );
  }

  private async available(userId: string) {
    if (!(await this.presence.isOnline(userId)))
      throw new WsException('Player is offline');
    if (await this.matchService.findActiveMatchForUser(userId))
      throw new WsException('Player is already in a match');
    if (
      !(await this.users.one(sql`("id" = ${this.id(userId)}) AND ("is_deleted" IS DISTINCT FROM ${true}) AND ("is_banned" IS DISTINCT FROM ${true})`))
    )
      throw new WsException('Player unavailable');
  }

  async invite(
    senderId: string,
    receiverId: string,
    mode: ArenaFriendMode,
    rematchOf?: string,
    roomId?: string,
  ) {
    this.id(senderId);
    this.id(receiverId);
    this.mode(mode);
    if (senderId === receiverId) throw new WsException('Choose another player');
    if (!(await this.presence.isOnline(senderId)))
      throw new WsException('Player is offline');
    await this.available(receiverId);
    await this.friendRooms.available(receiverId);
    let room = roomId
      ? await this.friendRooms.member(roomId, senderId)
      : await this.friendRooms.active(senderId);
    if (!room) {
      const created = await this.friendRooms.create(senderId, mode);
      room = await this.friendRooms.member(created.roomId, senderId);
    }
    if (String(room.hostId) !== senderId)
      throw new WsException('NOT_ROOM_HOST');
    if (room.status !== 'WAITING' || this.friendRooms.isFull(room))
      throw new WsException('ROOM_FULL');
    if (
      await this.invites.one(sql`("sender_id" = ${this.id(senderId)}) AND ("status" = ${'PENDING'}) AND ("expires_at" > ${new Date()})`)
    )
      throw new WsException('You already have a pending invitation');
    const config = this.settings
      ? await this.settings.requireEnabled(
          room.maxPlayers > 2 ? 'ROOM' : 'FRIEND',
        )
      : ARENA_DEFAULTS;
    const invite = await this.invites.insert({
      senderId: this.id(senderId),
      receiverId: this.id(receiverId),
      type: 'DUEL',
      roomId: room._id,
      mode: room.mode,
      rematchOf: rematchOf ? this.id(rematchOf) : null,
      expiresAt: new Date(Date.now() + config.friendly.inviteTimeout * 1000) });
    return this.inviteData(invite);
  }

  private async inviteData(invite: ArenaInvitation & { _id: string }) {
    const sender=await this.users.one(sql`id=${String(invite.senderId)}::uuid`);
    return {
      roomId: invite.roomId ? String(invite.roomId) : null,
      inviteId: String(invite._id),
      senderId: String(invite.senderId),
      receiverId: String(invite.receiverId),
      username: sender?.username || 'Player',
      avatarUrl: sender?.avatarUrl,
      mode: invite.mode,
      rematchOf: invite.rematchOf ? String(invite.rematchOf) : null,
      expiresAt: invite.expiresAt?.toISOString() };
  }

  async pending(userId: string) {
    const invites = await this.invites.select(sql`((("sender_id" = ${this.id(userId)}) OR ("receiver_id" = ${this.id(userId)}))) AND ("type" = ${'DUEL'}) AND ("status" = ${'PENDING'}) AND ("expires_at" > ${new Date()})`);
    return Promise.all(invites.map((invite) => this.inviteData(invite)));
  }

  async respond(userId: string, inviteId: string, accept: boolean) {
    const invite = await this.invites.patch(sql`("id" = ${this.id(inviteId)}) AND ("receiver_id" = ${this.id(userId)}) AND ("type" = ${'DUEL'}) AND ("status" = ${'PENDING'}) AND ("expires_at" > ${new Date()})`,{ status: accept ? 'ACCEPTED' : 'DECLINED' });
    if (!invite) throw new WsException('Invitation is unavailable or expired');
    const users = [String(invite.senderId), String(invite.receiverId)];
    if (!accept)
      return { users, event: 'friend:invite-declined', data: { inviteId } };
    try {
      await this.available(users[1]!);
      if (!invite.roomId) throw new WsException('ROOM_NOT_FOUND');
      const room = await this.friendRooms.member(
        String(invite.roomId),
        users[0]!,
      );
      const snapshot = await this.friendRooms.join(userId, room.code);
      return {
        users,
        event: 'friend:invite-accepted',
        data: { ...snapshot, inviteId } };
    } catch (error) {
      await this.invites.patch(sql`("id" = ${invite._id})`,{ status: 'CANCELLED' });
      return {
        users,
        event: 'friend:invite-cancelled',
        data: {
          inviteId,
          message:
            error instanceof Error ? error.message : 'Player unavailable' } };
    }
  }

  async cancel(userId: string, inviteId: string) {
    const invite = await this.invites.patch(sql`("id" = ${this.id(inviteId)}) AND ("sender_id" = ${this.id(userId)}) AND ("status" = ${'PENDING'})`,{ status: 'CANCELLED' });
    if (!invite) throw new WsException('Invitation unavailable');
    return {
      users: [String(invite.senderId), String(invite.receiverId)],
      event: 'friend:invite-cancelled',
      data: { inviteId } };
  }

  async cancelRoomInvites(roomId: string): Promise<FriendlyDelivery[]> {
    const events: FriendlyDelivery[] = [];
    for (const invite of await this.invites.select(sql`("room_id" = ${this.id(roomId)}) AND ("type" = ${'DUEL'}) AND ("status" = ${'PENDING'})`)) {
      const cancelled=await this.invites.patch(sql`id=${invite._id}::uuid AND status='PENDING'`,{status:'CANCELLED'});
      if (cancelled)
        events.push({
          users: [String(invite.senderId), String(invite.receiverId)],
          event: 'friend:invite-cancelled',
          data: { inviteId: String(invite._id) } });
    }
    return events;
  }

  async snapshot(matchId: string, userId: string) {
    const match = await this.member(matchId, userId);
    const players = await this.players.select(sql`("match_id" = ${match._id})`);
    const users=await this.users.select(sql`id=ANY(${players.map(p=>String(p.userId))}::uuid[])`);
    return {
      matchId,
      type: match.type,
      status: match.status,
      roomId: match.roomId ? String(match.roomId) : null,
      code: match.roomCodeSnapshot,
      nextMatchId: match.nextMatchId ? String(match.nextMatchId) : null,
      mode: match.friendMode,
      hostId: String(match.hostId),
      serverNow: new Date().toISOString(),
      players: players.map((p:any) => {
        const u = users.find((u) => String(u._id) === String(p.userId));
        return {
          userId: String(p.userId),
          username: u?.username || 'Player',
          avatarUrl: u?.avatarUrl,
          isReady: p.isReady,
          returnedToLobby: p.returnedToLobby,
          leftLobby: p.leftLobby,
          score: p.score,
          eliminated: (match.eliminatedUserIds ?? []).some(
            (id:any) => String(id) === String(p.userId),
          ),
          disconnectedAt: p.disconnectedAt?.toISOString() };
      }) };
  }

  async returnToLobby(matchId: string, userId: string) {
    const match = await this.member(matchId, userId);
    if (match.status !== ArenaMatchStatus.FINISHED || !match.roomId)
      throw new WsException('ROOM_NOT_FOUND');
    return this.friendRooms.snapshot(String(match.roomId), userId);
  }

  async leaveResult(
    _matchId: string,
    _userId: string,
  ): Promise<ArenaRoundEvent[]> {
    return [];
  }

  async ready(_matchId: string, _userId: string) {
    throw new WsException('Use friend-room:ready');
  }
  async setMode(_matchId: string, _userId: string, _mode: ArenaFriendMode) {
    throw new WsException('Use friend-room:settings-update');
  }
  async start(_matchId: string, _userId: string): Promise<ArenaRoundEvent[]> {
    throw new WsException('Use friend-room:start');
  }

  async gameSnapshot(matchId: string): Promise<ArenaRoundEvent[]> {
    const match = await this.matches.one(sql`id=${this.id(matchId)}::uuid`);
    if (!match) throw new WsException('Match not found');
    if (match.friendMode === ArenaFriendMode.WORD_GUESS)
      return [
        { event: 'word-guess:update', data: { matchId } },
        ...(match.status === ArenaMatchStatus.FINISHED
          ? [await this.rounds.finishedEvent(matchId)]
          : []),
      ];
    if (match.status === ArenaMatchStatus.FINISHED)
      return [await this.rounds.finishedEvent(matchId)];
    if (match.status !== ArenaMatchStatus.PLAYING) return [];
    if (match.friendMode !== ArenaFriendMode.WORD_CHAIN)
      return this.rounds.snapshot(matchId);
    return [
      {
        event: 'word-chain:turn',
        data: {
          matchId,
          currentTurnUserId: String(match.currentTurnUserId),
          previousWord: match.currentWord,
          requiredLetter: match.currentWord ? match.currentWord.slice(-1) : '',
          turnStartedAt: match.turnStartedAt?.toISOString(),
          turnDeadline: match.turnDeadline?.toISOString(),
          seconds: match.settingsSnapshot?.turnTime ?? 20,
          turnCount: match.turnCount,
          eliminatedUserIds: (match.eliminatedUserIds ?? []).map(String),
          usedWords: match.usedWords,
          serverNow: new Date().toISOString() } },
    ];
  }

  async wordGuessSnapshot(matchId: string, userId: string) {
    const match = await this.member(matchId, userId);
    if (match.friendMode !== ArenaFriendMode.WORD_GUESS)
      throw new WsException('INVALID_GAME_MODE');
    const attempts = match.wordGuessAttempts ?? [];
    const players = await this.players.select(sql`("match_id" = ${match._id})`);
    const finished = match.status === ArenaMatchStatus.FINISHED;
    const secret = finished
      ? await this.matches.one(sql`id=${match._id}::uuid`)
      : null;
    return {
      matchId,
      status: match.status,
      revision: match.wordGuessRevision ?? 0,
      maxAttempts: 5,
      wordLength: 5,
      attempts: attempts
        .filter((attempt:any) => attempt.userId === userId)
        .map(({ word, feedback }:any) => ({ word, feedback })),
      players: players.map((player) => ({
        userId: String(player.userId),
        attempts: attempts.filter(
          (attempt:any) => attempt.userId === String(player.userId),
        ).length,
        eliminated: (match.eliminatedUserIds ?? []).some(
          (id:any) => String(id) === String(player.userId),
        ) })),
      winnerId: finished && match.winnerId ? String(match.winnerId) : null,
      isDraw: finished && match.isDraw,
      ...(finished ? { answer: secret?.wordGuessAnswer } : {}) };
  }

  async submitWordGuess(matchId: string, userId: string, value: string) {
    await this.member(matchId, userId);
    const word = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!/^[a-z]{5}$/.test(word))
      throw new WsException('WORD_MUST_HAVE_FIVE_LETTERS');
    for (let retry = 0; retry < 8; retry++) {
      const match=await this.matches.one(sql`id=${this.id(matchId)}::uuid`);
      if (
        !match ||
        match.friendMode !== ArenaFriendMode.WORD_GUESS ||
        match.status !== ArenaMatchStatus.PLAYING ||
        match.wordGuessSolvedBy
      )
        throw new WsException('GAME_NOT_PLAYING');
      const player = await this.players.one(sql`("match_id" = ${match._id}) AND ("user_id" = ${this.id(userId)}) AND ("status" = ${'PLAYING'})`);
      if (
        !player ||
        (match.eliminatedUserIds ?? []).some((id:any) => String(id) === userId)
      )
        throw new WsException('NOT_ACTIVE_PLAYER');
      const attempts = match.wordGuessAttempts ?? [];
      const mine = attempts.filter((attempt:any) => attempt.userId === userId);
      if (mine.length >= 5) throw new WsException('NO_GUESSES_LEFT');
      if (mine.some((attempt:any) => attempt.word === word))
        throw new WsException('WORD_ALREADY_GUESSED');
      if (!match.wordGuessAnswer) throw new WsException('GAME_NOT_READY');
      const feedback = gradeWordGuess(match.wordGuessAnswer, word);
      const solved = feedback.every((tile) => tile === 'correct');
      const changed=await this.matches.patch(sql`id=${match._id}::uuid AND status=${ArenaMatchStatus.PLAYING} AND word_guess_revision=${match.wordGuessRevision}
        AND word_guess_solved_by IS NULL AND room_revision=${match.roomRevision??0}`,solved?{wordGuessSolvedBy:userId}:{},{
          wordGuessAttempts:sql`COALESCE(word_guess_attempts,'[]'::jsonb)||${JSON.stringify([{userId,word,feedback}])}::jsonb`,
          wordGuessRevision:sql`COALESCE(word_guess_revision,0)+1`,
        });
      if (!changed) continue;
      if (solved) {
        await this.players.patch(sql`("match_id" = ${match._id}) AND ("user_id" = ${this.id(userId)})`,{ score: (5 - mine.length) * 100 });
        await this.matchService.finishMatch(
          matchId,
          ArenaMatchFinishReason.NORMAL,
          userId,
        );
      } else {
        const players = await this.players.select(sql`("match_id" = ${match._id})`);
        if (
          players.every(
            (p:any) =>
              (changed.eliminatedUserIds ?? []).some(
                (id:any) => String(id) === String(p.userId),
              ) ||
              changed.wordGuessAttempts.filter(
                (a:any) => a.userId === String(p.userId),
              ).length >= 5,
          )
        )
          await this.matchService.finishMatch(
            matchId,
            ArenaMatchFinishReason.NORMAL,
          );
      }
      return this.wordGuessSnapshot(matchId, userId);
    }
    throw new WsException('PLEASE_RETRY');
  }

  async submit(
    matchId: string,
    userId: string,
    value: string,
  ): Promise<ArenaRoundEvent[]> {
    const match = await this.member(matchId, userId);
    const invalid = (reason: string): ArenaRoundEvent[] => [
      { event: 'word-chain:invalid', data: { matchId, reason } },
    ];
    if (
      match.friendMode !== ArenaFriendMode.WORD_CHAIN ||
      match.status !== ArenaMatchStatus.PLAYING
    )
      throw new WsException('Word Chain is not playing');
    if (
      (match.eliminatedUserIds ?? []).some((id:any) => String(id) === userId) ||
      String(match.currentTurnUserId) !== userId ||
      match.chainPausedAt
    )
      return invalid('NOT_YOUR_TURN');
    if (!match.turnDeadline || Date.now() >= match.turnDeadline.getTime())
      return invalid('TURN_EXPIRED');
    const word = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!/^[a-z]{2,80}$/.test(word)) return invalid('WORD_NOT_FOUND');
    const requiredPrefix = match.currentWord ? match.currentWord.slice(-1) : '';
    if (requiredPrefix && !word.startsWith(requiredPrefix))
      return invalid('INVALID_START_LETTER');
    if (match.usedWords.includes(word)) return invalid('WORD_ALREADY_USED');
    if(!(await contentRows(this.nativeDb,'words',{word,publishedOnly:true,activeOnly:true,limit:1}))[0])return invalid('WORD_NOT_FOUND');
    const opponent =
      match.type === ArenaMatchType.ROOM
        ? await this.matchService.nextRoomPlayer(matchId, userId)
        : await this.matchService.getOpponentUserId(matchId, userId);
    if (!opponent) throw new WsException('Opponent unavailable');
    const now = new Date();
    // CAS protects duplicate submissions and checks the deadline again after vocabulary lookup.
    const updated=await this.matches.patch(sql`id=${match._id}::uuid AND status=${ArenaMatchStatus.PLAYING} AND chain_paused_at IS NULL
      AND current_turn_user_id=${this.id(userId)}::uuid AND turn_count=${match.turnCount}
      AND (${match.type!==ArenaMatchType.ROOM}::boolean OR room_revision=${match.roomRevision??0}) AND turn_deadline>${now}
      AND NOT (COALESCE(NULLIF(used_words,''),'[]')::jsonb ? ${word})`,{
        currentWord:word,requiredLetter:word.slice(-1),currentTurnUserId:this.id(opponent),turnStartedAt:now,
        turnDeadline:new Date(now.getTime()+(match.settingsSnapshot?.turnTime??20)*1000),
      },{usedWords:sql`(COALESCE(NULLIF(used_words,''),'[]')::jsonb||${JSON.stringify([word])}::jsonb)::text`,turnCount:sql`COALESCE(turn_count,0)+1`});
    if (!updated) return invalid('TURN_EXPIRED');
    if (match.type === ArenaMatchType.ROOM)
      await this.players.patch(sql`("match_id" = ${match._id}) AND ("user_id" = ${this.id(userId)})`,{},{"score":sql`COALESCE("score",0)+${1}`});
    return [
      ...(match.type === ArenaMatchType.ROOM
        ? [
            {
              event: 'friend:snapshot',
              data: await this.snapshot(matchId, userId) },
          ]
        : []),
      { event: 'word-chain:accepted', data: { matchId, userId, word } },
      ...(await this.gameSnapshot(matchId)),
    ];
  }

  async leave(matchId: string, userId: string): Promise<ArenaRoundEvent[]> {
    const match = await this.member(matchId, userId);
    if (
      [ArenaMatchStatus.WAITING, ArenaMatchStatus.COUNTDOWN].includes(
        match.status,
      )
    ) {
      const cancelled=await this.matches.patch(sql`id=${match._id}::uuid AND status=ANY(${[ArenaMatchStatus.WAITING,ArenaMatchStatus.COUNTDOWN]}::text[])`,
        {status:ArenaMatchStatus.CANCELLED,cancelReason:'Player left the room'});
      if (!cancelled) return this.leave(matchId, userId);
      await this.players.patch(sql`("match_id" = ${match._id})`,{ status: 'LEFT' });
      return [
        {
          event: 'friend:cancelled',
          data: { matchId, message: 'The other player left the room.' } },
      ];
    }
    if (
      match.type === ArenaMatchType.ROOM &&
      match.status === ArenaMatchStatus.PLAYING
    ) {
      await this.matchService.dropRoomPlayer(
        matchId,
        userId,
        ArenaMatchFinishReason.PLAYER_LEFT,
      );
      return [
        {
          event: 'friend:snapshot',
          data: await this.snapshot(matchId, userId) },
        ...(await this.gameSnapshot(matchId)),
      ];
    }
    if (match.status === ArenaMatchStatus.PLAYING)
      await this.matchService.finishMatch(
        matchId,
        ArenaMatchFinishReason.PLAYER_LEFT,
        (await this.matchService.getOpponentUserId(matchId, userId)) ??
          undefined,
      );
    const result = await this.gameSnapshot(matchId);
    return [...result, ...(await this.leaveResult(matchId, userId))];
  }

  async rematch(matchId: string, userId: string) {
    const match = await this.member(matchId, userId);
    if (match.status !== ArenaMatchStatus.FINISHED)
      throw new WsException('Match has not finished');
    const opponent = await this.matchService.getOpponentUserId(matchId, userId);
    if (!opponent) throw new WsException('Opponent unavailable');
    return this.invite(
      userId,
      opponent,
      match.friendMode ?? ArenaFriendMode.CLASSIC,
      matchId,
    );
  }

  async tick(): Promise<FriendlyDelivery[]> {
    const events: FriendlyDelivery[] = [];
    for (const invite of await this.invites.select(sql`("type" = ${'DUEL'}) AND ("status" = ${'PENDING'}) AND ("expires_at" <= ${new Date()})`)) {
      const expired=await this.invites.patch(sql`id=${invite._id}::uuid AND status='PENDING'`,{status:'EXPIRED'});
      if (expired)
        events.push({
          users: [String(invite.senderId), String(invite.receiverId)],
          event: 'friend:invite-expired',
          data: { inviteId: String(invite._id) } });
    }
    for (const match of await this.matches.select(sql`("type"=ANY(${[ArenaMatchType.FRIEND, ArenaMatchType.ROOM]}::text[])) AND ("friend_mode" = ${ArenaFriendMode.WORD_CHAIN}) AND ("status" = ${ArenaMatchStatus.PLAYING}) AND ("chain_paused_at" IS NULL) AND ("turn_deadline" <= ${new Date()})`)) {
      if (match.type === ArenaMatchType.ROOM) {
        await this.matchService.dropRoomPlayer(
          String(match._id),
          String(match.currentTurnUserId),
          ArenaMatchFinishReason.TURN_TIMEOUT,
          match.turnCount,
        );
        events.push({
          matchId: String(match._id),
          event: 'friend:snapshot',
          data: await this.snapshot(
            String(match._id),
            String(match.currentTurnUserId),
          ) });
        for (const event of await this.gameSnapshot(String(match._id)))
          events.push({ matchId: String(match._id), ...event });
        continue;
      }
      const opponent = await this.matchService.getOpponentUserId(
        String(match._id),
        String(match.currentTurnUserId),
      );
      // The FINISHING lock checks this exact expired turn atomically.
      const finished = await this.matchService.finishMatch(
        String(match._id),
        ArenaMatchFinishReason.TURN_TIMEOUT,
        opponent ?? undefined,
        match.turnCount,
      );
      if (finished)
        events.push({
          matchId: String(match._id),
          ...(await this.rounds.finishedEvent(String(match._id))) });
    }
    for (const player of await this.players.select(sql`("status" = ${'DISCONNECTED'}) AND ("disconnected_at" <= ${new Date(Date.now() - 5000)})`)) {
      const match = await this.matches.one(sql`id=${player.matchId}::uuid`);
      if (
        !match ||
        match.type !== ArenaMatchType.ROOM ||
        match.status !== ArenaMatchStatus.PLAYING
      )
        continue;
      if (
        player.disconnectedAt &&
        player.disconnectedAt.getTime() +
          (match.runtimePolicy?.reconnectGrace ?? 20) * 1000 >
          Date.now()
      )
        continue;
      await this.matchService.dropRoomPlayer(
        String(match._id),
        String(player.userId),
        ArenaMatchFinishReason.DISCONNECT_TIMEOUT,
      );
      events.push({
        matchId: String(match._id),
        event: 'friend:snapshot',
        data: await this.snapshot(String(match._id), String(player.userId)) });
      for (const event of await this.gameSnapshot(String(match._id)))
        events.push({ matchId: String(match._id), ...event });
    }
    return events;
  }
}
