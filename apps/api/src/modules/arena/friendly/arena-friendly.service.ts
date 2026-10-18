import { gradeWordGuess } from './word-guess.utils.js';
import { ArenaFriendRoomService } from './arena-friend-room.service.js';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WsException } from '@nestjs/websockets';
import { Model, Types } from 'mongoose';
import {
  ArenaMatch,
  ArenaMatchStatus,
  ArenaMatchType,
  ArenaFriendMode,
  ArenaMatchFinishReason,
} from '../schemas/arena-match.schema.js';
import { ArenaInvitation } from '../schemas/arena-invitation.schema.js';
import { ArenaMatchPlayer } from '../schemas/arena-match-player.schema.js';
import { User } from '../../users/schema/user.schema.js';
import { Word } from '../../vocabulary/words/word.schema.js';
import { ArenaMatchService } from '../matches/arena-match.service.js';
import {
  ArenaRoundService,
  ArenaRoundEvent,
} from '../question/arena-round.service.js';
import { ArenaQuestionService } from '../question/arena-question.service.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';
import { ArenaService } from '../arena.service.js';

export type FriendlyDelivery = {
  users?: string[];
  matchId?: string;
  event: string;
  data: Record<string, unknown>;
};

@Injectable()
export class ArenaFriendlyService {
  constructor(
    @InjectModel(ArenaMatch.name) private readonly matches: Model<ArenaMatch>,
    @InjectModel(ArenaInvitation.name)
    private readonly invites: Model<ArenaInvitation>,
    @InjectModel(ArenaMatchPlayer.name)
    private readonly players: Model<ArenaMatchPlayer>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Word.name) private readonly words: Model<Word>,
    private readonly matchService: ArenaMatchService,
    private readonly rounds: ArenaRoundService,
    private readonly questions: ArenaQuestionService,
    private readonly presence: ArenaPresenceService,
    private readonly arena: ArenaService,
    private readonly friendRooms: ArenaFriendRoomService,
  ) {}

  private id(value: string) {
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
      throw new WsException('Invalid ID');
    return new Types.ObjectId(value);
  }

  private mode(value: ArenaFriendMode) {
    if (!Object.values(ArenaFriendMode).includes(value))
      throw new WsException('Invalid Friendly mode');
    return value;
  }

  async member(matchId: string, userId: string) {
    await this.rounds.assertMember(matchId, userId);
    const match = await this.matches.findById(this.id(matchId));
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
    const history = await this.players
      .find({ userId: this.id(userId), status: 'FINISHED' })
      .sort({ finishedAt: -1 })
      .limit(30);
    const opponents = await this.players.find({
      matchId: { $in: history.map((p) => p.matchId) },
      userId: { $ne: this.id(userId) },
    });
    const recent = new Set(opponents.map((p) => String(p.userId)));
    // The application has no social friendship model yet; only return previous opponents.
    const escaped = String(search)
      .slice(0, 80)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await this.users
      .find({
        _id: { $ne: this.id(userId) },
        isDeleted: { $ne: true },
        isBanned: { $ne: true },
        ...(escaped ? { username: { $regex: escaped, $options: 'i' } } : {}),
      })
      .select('_id username avatarUrl')
      .limit(100)
      .lean();
    const entries = await Promise.all(
      users.map(async (user) => ({
        userId: String(user._id),
        username: user.username || 'Player',
        avatarUrl: user.avatarUrl,
        online: await this.presence.isOnline(String(user._id)),
        recent: recent.has(String(user._id)),
      })),
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
      !(await this.users.exists({
        _id: this.id(userId),
        isDeleted: { $ne: true },
        isBanned: { $ne: true },
      }))
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
      await this.invites.exists({
        senderId: this.id(senderId),
        status: 'PENDING',
        expiresAt: { $gt: new Date() },
      })
    )
      throw new WsException('You already have a pending invitation');
    const invite = await this.invites.create({
      senderId: this.id(senderId),
      receiverId: this.id(receiverId),
      type: 'DUEL',
      roomId: room._id,
      mode: room.mode,
      rematchOf: rematchOf ? this.id(rematchOf) : null,
      expiresAt: new Date(Date.now() + 10000),
    });
    return this.inviteData(invite);
  }

  private async inviteData(invite: ArenaInvitation & { _id: Types.ObjectId }) {
    const sender = await this.users
      .findById(invite.senderId)
      .select('username avatarUrl');
    return {
      roomId: invite.roomId ? String(invite.roomId) : null,
      inviteId: String(invite._id),
      senderId: String(invite.senderId),
      receiverId: String(invite.receiverId),
      username: sender?.username || 'Player',
      avatarUrl: sender?.avatarUrl,
      mode: invite.mode,
      rematchOf: invite.rematchOf ? String(invite.rematchOf) : null,
      expiresAt: invite.expiresAt?.toISOString(),
    };
  }

  async pending(userId: string) {
    const invites = await this.invites.find({
      $or: [{ senderId: this.id(userId) }, { receiverId: this.id(userId) }],
      type: 'DUEL',
      status: 'PENDING',
      expiresAt: { $gt: new Date() },
    });
    return Promise.all(invites.map((invite) => this.inviteData(invite)));
  }

  async respond(userId: string, inviteId: string, accept: boolean) {
    const invite = await this.invites.findOneAndUpdate(
      {
        _id: this.id(inviteId),
        receiverId: this.id(userId),
        type: 'DUEL',
        status: 'PENDING',
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: accept ? 'ACCEPTED' : 'DECLINED' } },
      { returnDocument: 'after' },
    );
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
        data: { ...snapshot, inviteId },
      };
    } catch (error) {
      await this.invites.updateOne(
        { _id: invite._id },
        { $set: { status: 'CANCELLED' } },
      );
      return {
        users,
        event: 'friend:invite-cancelled',
        data: {
          inviteId,
          message:
            error instanceof Error ? error.message : 'Player unavailable',
        },
      };
    }
  }

  async cancel(userId: string, inviteId: string) {
    const invite = await this.invites.findOneAndUpdate(
      { _id: this.id(inviteId), senderId: this.id(userId), status: 'PENDING' },
      { $set: { status: 'CANCELLED' } },
      { returnDocument: 'after' },
    );
    if (!invite) throw new WsException('Invitation unavailable');
    return {
      users: [String(invite.senderId), String(invite.receiverId)],
      event: 'friend:invite-cancelled',
      data: { inviteId },
    };
  }

  async cancelRoomInvites(roomId: string): Promise<FriendlyDelivery[]> {
    const events: FriendlyDelivery[] = [];
    for (const invite of await this.invites.find({
      roomId: this.id(roomId),
      type: 'DUEL',
      status: 'PENDING',
    })) {
      const cancelled = await this.invites.updateOne(
        { _id: invite._id, status: 'PENDING' },
        { $set: { status: 'CANCELLED' } },
      );
      if (cancelled.modifiedCount)
        events.push({
          users: [String(invite.senderId), String(invite.receiverId)],
          event: 'friend:invite-cancelled',
          data: { inviteId: String(invite._id) },
        });
    }
    return events;
  }

  async snapshot(matchId: string, userId: string) {
    const match = await this.member(matchId, userId);
    const players = await this.players.find({ matchId: match._id });
    const users = await this.users
      .find({ _id: { $in: players.map((p) => p.userId) } })
      .select('username avatarUrl');
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
      players: players.map((p) => {
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
            (id) => String(id) === String(p.userId),
          ),
          disconnectedAt: p.disconnectedAt?.toISOString(),
        };
      }),
    };
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
    const match = await this.matches.findById(this.id(matchId));
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
          serverNow: new Date().toISOString(),
        },
      },
    ];
  }

  async wordGuessSnapshot(matchId: string, userId: string) {
    const match = await this.member(matchId, userId);
    if (match.friendMode !== ArenaFriendMode.WORD_GUESS)
      throw new WsException('INVALID_GAME_MODE');
    const attempts = match.wordGuessAttempts ?? [];
    const players = await this.players.find({ matchId: match._id });
    const finished = match.status === ArenaMatchStatus.FINISHED;
    const secret = finished
      ? await this.matches.findById(match._id).select('+wordGuessAnswer')
      : null;
    return {
      matchId,
      status: match.status,
      revision: match.wordGuessRevision ?? 0,
      maxAttempts: 5,
      wordLength: 5,
      attempts: attempts
        .filter((attempt) => attempt.userId === userId)
        .map(({ word, feedback }) => ({ word, feedback })),
      players: players.map((player) => ({
        userId: String(player.userId),
        attempts: attempts.filter(
          (attempt) => attempt.userId === String(player.userId),
        ).length,
        eliminated: (match.eliminatedUserIds ?? []).some(
          (id) => String(id) === String(player.userId),
        ),
      })),
      winnerId: finished && match.winnerId ? String(match.winnerId) : null,
      isDraw: finished && match.isDraw,
      ...(finished ? { answer: secret?.wordGuessAnswer } : {}),
    };
  }

  async submitWordGuess(matchId: string, userId: string, value: string) {
    await this.member(matchId, userId);
    const word = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!/^[a-z]{5}$/.test(word))
      throw new WsException('WORD_MUST_HAVE_FIVE_LETTERS');
    for (let retry = 0; retry < 8; retry++) {
      const match = await this.matches
        .findById(this.id(matchId))
        .select('+wordGuessAnswer');
      if (
        !match ||
        match.friendMode !== ArenaFriendMode.WORD_GUESS ||
        match.status !== ArenaMatchStatus.PLAYING ||
        match.wordGuessSolvedBy
      )
        throw new WsException('GAME_NOT_PLAYING');
      const player = await this.players.findOne({
        matchId: match._id,
        userId: this.id(userId),
        status: 'PLAYING',
      });
      if (
        !player ||
        (match.eliminatedUserIds ?? []).some((id) => String(id) === userId)
      )
        throw new WsException('NOT_ACTIVE_PLAYER');
      const attempts = match.wordGuessAttempts ?? [];
      const mine = attempts.filter((attempt) => attempt.userId === userId);
      if (mine.length >= 5) throw new WsException('NO_GUESSES_LEFT');
      if (mine.some((attempt) => attempt.word === word))
        throw new WsException('WORD_ALREADY_GUESSED');
      if (!match.wordGuessAnswer) throw new WsException('GAME_NOT_READY');
      const feedback = gradeWordGuess(match.wordGuessAnswer, word);
      const solved = feedback.every((tile) => tile === 'correct');
      const changed = await this.matches.findOneAndUpdate(
        {
          _id: match._id,
          status: ArenaMatchStatus.PLAYING,
          wordGuessRevision: match.wordGuessRevision,
          wordGuessSolvedBy: null,
          roomRevision: match.roomRevision ?? 0,
        },
        {
          $push: { wordGuessAttempts: { userId, word, feedback } },
          $inc: { wordGuessRevision: 1 },
          ...(solved ? { $set: { wordGuessSolvedBy: userId } } : {}),
        },
        { returnDocument: 'after' },
      );
      if (!changed) continue;
      if (solved) {
        await this.players.updateOne(
          { matchId: match._id, userId: this.id(userId) },
          { $set: { score: (5 - mine.length) * 100 } },
        );
        await this.matchService.finishMatch(
          matchId,
          ArenaMatchFinishReason.NORMAL,
          userId,
        );
      } else {
        const players = await this.players.find({ matchId: match._id });
        if (
          players.every(
            (p) =>
              (changed.eliminatedUserIds ?? []).some(
                (id) => String(id) === String(p.userId),
              ) ||
              changed.wordGuessAttempts.filter(
                (a) => a.userId === String(p.userId),
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
      (match.eliminatedUserIds ?? []).some((id) => String(id) === userId) ||
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
    if (
      !(await this.words.exists({
        word: { $regex: `^${word}$`, $options: 'i' },
        isActive: true,
        isDeleted: { $ne: true },
      }))
    )
      return invalid('WORD_NOT_FOUND');
    const opponent =
      match.type === ArenaMatchType.ROOM
        ? await this.matchService.nextRoomPlayer(matchId, userId)
        : await this.matchService.getOpponentUserId(matchId, userId);
    if (!opponent) throw new WsException('Opponent unavailable');
    const now = new Date();
    // CAS protects duplicate submissions and checks the deadline again after vocabulary lookup.
    const updated = await this.matches.findOneAndUpdate(
      {
        _id: match._id,
        status: ArenaMatchStatus.PLAYING,
        chainPausedAt: null,
        currentTurnUserId: this.id(userId),
        turnCount: match.turnCount,
        ...(match.type === ArenaMatchType.ROOM
          ? { roomRevision: match.roomRevision ?? 0 }
          : {}),
        turnDeadline: { $gt: now },
        usedWords: { $ne: word },
      },
      {
        $set: {
          currentWord: word,
          requiredLetter: word.slice(-1),
          currentTurnUserId: this.id(opponent),
          turnStartedAt: now,
          turnDeadline: new Date(
            now.getTime() + (match.settingsSnapshot?.turnTime ?? 20) * 1000,
          ),
        },
        $push: { usedWords: word },
        $inc: { turnCount: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!updated) return invalid('TURN_EXPIRED');
    if (match.type === ArenaMatchType.ROOM)
      await this.players.updateOne(
        { matchId: match._id, userId: this.id(userId) },
        { $inc: { score: 1 } },
      );
    return [
      ...(match.type === ArenaMatchType.ROOM
        ? [
            {
              event: 'friend:snapshot',
              data: await this.snapshot(matchId, userId),
            },
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
      const cancelled = await this.matches.updateOne(
        {
          _id: match._id,
          status: {
            $in: [ArenaMatchStatus.WAITING, ArenaMatchStatus.COUNTDOWN],
          },
        },
        {
          $set: {
            status: ArenaMatchStatus.CANCELLED,
            cancelReason: 'Player left the room',
          },
        },
      );
      if (!cancelled.modifiedCount) return this.leave(matchId, userId);
      await this.players.updateMany(
        { matchId: match._id },
        { $set: { status: 'LEFT' } },
      );
      return [
        {
          event: 'friend:cancelled',
          data: { matchId, message: 'The other player left the room.' },
        },
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
          data: await this.snapshot(matchId, userId),
        },
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
    for (const invite of await this.invites.find({
      type: 'DUEL',
      status: 'PENDING',
      expiresAt: { $lte: new Date() },
    })) {
      const expired = await this.invites.updateOne(
        { _id: invite._id, status: 'PENDING' },
        { $set: { status: 'EXPIRED' } },
      );
      if (expired.modifiedCount)
        events.push({
          users: [String(invite.senderId), String(invite.receiverId)],
          event: 'friend:invite-expired',
          data: { inviteId: String(invite._id) },
        });
    }
    for (const match of await this.matches.find({
      type: { $in: [ArenaMatchType.FRIEND, ArenaMatchType.ROOM] },
      friendMode: ArenaFriendMode.WORD_CHAIN,
      status: ArenaMatchStatus.PLAYING,
      chainPausedAt: null,
      turnDeadline: { $lte: new Date() },
    })) {
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
          ),
        });
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
          ...(await this.rounds.finishedEvent(String(match._id))),
        });
    }
    for (const player of await this.players.find({
      status: 'DISCONNECTED',
      disconnectedAt: { $lte: new Date(Date.now() - 20000) },
    })) {
      const match = await this.matches.findById(player.matchId);
      if (
        !match ||
        match.type !== ArenaMatchType.ROOM ||
        match.status !== ArenaMatchStatus.PLAYING
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
        data: await this.snapshot(String(match._id), String(player.userId)),
      });
      for (const event of await this.gameSnapshot(String(match._id)))
        events.push({ matchId: String(match._id), ...event });
    }
    return events;
  }
}
