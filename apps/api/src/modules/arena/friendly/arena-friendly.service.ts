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
    if (!match || match.type !== ArenaMatchType.FRIEND)
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
  ) {
    this.id(senderId);
    this.id(receiverId);
    this.mode(mode);
    if (senderId === receiverId) throw new WsException('Choose another player');
    await Promise.all([this.available(senderId), this.available(receiverId)]);
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
      mode,
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
      { new: true },
    );
    if (!invite) throw new WsException('Invitation is unavailable or expired');
    const users = [String(invite.senderId), String(invite.receiverId)];
    if (!accept)
      return { users, event: 'friend:invite-declined', data: { inviteId } };
    try {
      await Promise.all(users.map((id) => this.available(id)));
      await Promise.all(users.map((id) => this.arena.getOrCreateProfile(id)));
      const { match } = await this.matchService.createFriendMatch(
        users[0]!,
        users[1]!,
        invite.mode,
      );
      return {
        users,
        event: 'friend:match-created',
        data: { matchId: String(match._id), mode: invite.mode, inviteId },
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
      { new: true },
    );
    if (!invite) throw new WsException('Invitation unavailable');
    return {
      users: [String(invite.senderId), String(invite.receiverId)],
      event: 'friend:invite-cancelled',
      data: { inviteId },
    };
  }

  async snapshot(matchId: string, userId: string) {
    const match = await this.member(matchId, userId);
    const players = await this.players.find({ matchId: match._id });
    const users = await this.users
      .find({ _id: { $in: players.map((p) => p.userId) } })
      .select('username avatarUrl');
    return {
      matchId,
      status: match.status,
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
          disconnectedAt: p.disconnectedAt?.toISOString(),
        };
      }),
    };
  }

  // Keep the completed match immutable while each player chooses to return.
  // Only create the next round after both have returned to this same lobby.
  async returnToLobby(matchId: string, userId: string) {
    const match = await this.member(matchId, userId);
    if (match.status !== ArenaMatchStatus.FINISHED)
      return this.snapshot(matchId, userId);
    if (match.nextMatchId) {
      await this.players.updateOne(
        { matchId: match._id, userId: this.id(userId) },
        { $set: { returnedToLobby: true, leftLobby: false } },
      );
      return this.snapshot(matchId, userId);
    }
    if (await this.matchService.findActiveMatchForUser(userId))
      throw new WsException('Player is already in a match');
    await this.players.updateOne(
      { matchId: match._id, userId: this.id(userId) },
      { $set: { returnedToLobby: true, leftLobby: false, isReady: false } },
    );
    const players = await this.players.find({ matchId: match._id });
    if (
      players.length !== 2 ||
      players.some((p) => !p.returnedToLobby || p.leftLobby)
    )
      return this.snapshot(matchId, userId);
    const locked = await this.matches.findOneAndUpdate(
      {
        _id: match._id,
        status: ArenaMatchStatus.FINISHED,
        nextMatchId: null,
        lobbyStarting: { $ne: true },
      },
      { $set: { lobbyStarting: true } },
      { new: true },
    );
    if (!locked) return this.snapshot(matchId, userId);
    try {
      const opponent = players.find(
        (p) => String(p.userId) !== String(match.hostId),
      );
      if (!opponent) throw new WsException('Opponent unavailable');
      const { match: next } = await this.matchService.createFriendMatch(
        String(match.hostId),
        String(opponent.userId),
        match.friendMode ?? ArenaFriendMode.CLASSIC,
      );
      await this.matches.updateOne(
        { _id: match._id },
        { $set: { nextMatchId: next._id } },
      );
      // A tab can close while the next round is being created.
      const currentPlayers = await this.players.find({ matchId: match._id });
      const departed = currentPlayers.find((p) => p.leftLobby);
      if (departed) await this.leaveResult(matchId, String(departed.userId));
    } finally {
      await this.matches.updateOne(
        { _id: match._id },
        { $set: { lobbyStarting: false } },
      );
    }
    return this.snapshot(matchId, userId);
  }

  async leaveResult(
    matchId: string,
    userId: string,
  ): Promise<ArenaRoundEvent[]> {
    const match = await this.matches.findById(this.id(matchId));
    if (
      match?.type !== ArenaMatchType.FRIEND ||
      match.status !== ArenaMatchStatus.FINISHED
    )
      return [];
    await this.players.updateOne(
      { matchId: match._id, userId: this.id(userId) },
      { $set: { returnedToLobby: false, leftLobby: true, isReady: false } },
    );
    const next = match.nextMatchId
      ? await this.matches.findById(match.nextMatchId)
      : null;
    const events =
      next?.status === ArenaMatchStatus.WAITING
        ? await this.leave(String(next._id), userId)
        : [];
    return [
      ...events,
      { event: 'friend:snapshot', data: await this.snapshot(matchId, userId) },
    ];
  }

  async ready(matchId: string, userId: string) {
    const match = await this.member(matchId, userId);
    if (
      match.status !== ArenaMatchStatus.WAITING ||
      String(match.hostId) === userId
    )
      throw new WsException('Only the invited player can ready in the lobby');
    await this.players.updateOne(
      { matchId: match._id, userId: this.id(userId) },
      {
        $set: {
          isReady: true,
          readyAt: new Date(),
          readyMode: match.friendMode,
        },
      },
    );
  }

  async setMode(matchId: string, userId: string, mode: ArenaFriendMode) {
    const match = await this.member(matchId, userId);
    if (
      String(match.hostId) !== userId ||
      match.status !== ArenaMatchStatus.WAITING
    )
      throw new WsException('Only the host can change the lobby mode');
    if (match.friendMode === this.mode(mode)) return;
    const changed = await this.matches.updateOne(
      { _id: match._id, status: ArenaMatchStatus.WAITING },
      { $set: { friendMode: this.mode(mode) } },
    );
    if (!changed.modifiedCount)
      throw new WsException('Lobby changed; try again');
    await this.players.updateMany(
      { matchId: match._id },
      { $set: { isReady: false, readyAt: null, readyMode: null } },
    );
  }

  async start(matchId: string, userId: string): Promise<ArenaRoundEvent[]> {
    const match = await this.member(matchId, userId);
    if (
      String(match.hostId) !== userId ||
      match.status !== ArenaMatchStatus.WAITING
    )
      throw new WsException('Only the host can start a waiting match');
    const players = await this.players.find({ matchId: match._id });
    const online = await Promise.all(
      players.map((p) => this.presence.isOnline(String(p.userId))),
    );
    if (
      players.length !== 2 ||
      online.some((value) => !value) ||
      players.some(
        (p) =>
          p.status !== 'PLAYING' ||
          (String(p.userId) !== userId &&
            (!p.isReady || p.readyMode !== match.friendMode)),
      )
    )
      throw new WsException('Opponent is not ready or connected');
    const now = new Date();
    // COUNTDOWN reserves the start while question snapshots are generated.
    const locked = await this.matches.findOneAndUpdate(
      {
        _id: match._id,
        status: ArenaMatchStatus.WAITING,
        friendMode: match.friendMode,
      },
      { $set: { status: ArenaMatchStatus.COUNTDOWN } },
      { new: true },
    );
    if (!locked) throw new WsException('Lobby changed; try again');
    try {
      if (match.friendMode === ArenaFriendMode.CLASSIC)
        await this.questions.createRankedQuestions(matchId, 10);
      const started = await this.matches.findOneAndUpdate(
        { _id: match._id, status: ArenaMatchStatus.COUNTDOWN },
        {
          $set: {
            status: ArenaMatchStatus.PLAYING,
            startedAt: now,
            ...(match.friendMode === ArenaFriendMode.WORD_CHAIN
              ? {
                  currentTurnUserId: match.hostId,
                  turnStartedAt: now,
                  turnDeadline: new Date(now.getTime() + 20000),
                }
              : {}),
          },
        },
        { new: true },
      );
      if (!started) throw new WsException('Match was cancelled');
    } catch (error) {
      await this.matches.updateOne(
        { _id: match._id, status: ArenaMatchStatus.COUNTDOWN },
        { $set: { status: ArenaMatchStatus.WAITING } },
      );
      throw error;
    }
    return [
      { event: 'friend:match-start', data: { matchId } },
      ...(await this.gameSnapshot(matchId)),
    ];
  }

  async gameSnapshot(matchId: string): Promise<ArenaRoundEvent[]> {
    const match = await this.matches.findById(this.id(matchId));
    if (!match) throw new WsException('Match not found');
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
          requiredLetter: match.currentWord ? match.currentWord.slice(-2) : '',
          turnStartedAt: match.turnStartedAt?.toISOString(),
          turnDeadline: match.turnDeadline?.toISOString(),
          seconds: 20,
          turnCount: match.turnCount,
          usedWords: match.usedWords,
          serverNow: new Date().toISOString(),
        },
      },
    ];
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
    if (String(match.currentTurnUserId) !== userId || match.chainPausedAt)
      return invalid('NOT_YOUR_TURN');
    if (!match.turnDeadline || Date.now() >= match.turnDeadline.getTime())
      return invalid('TURN_EXPIRED');
    const word = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!/^[a-z]{2,80}$/.test(word)) return invalid('WORD_NOT_FOUND');
    const requiredPrefix = match.currentWord ? match.currentWord.slice(-2) : '';
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
    const opponent = await this.matchService.getOpponentUserId(matchId, userId);
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
        turnDeadline: { $gt: now },
        usedWords: { $ne: word },
      },
      {
        $set: {
          currentWord: word,
          requiredLetter: word.slice(-2),
          currentTurnUserId: this.id(opponent),
          turnStartedAt: now,
          turnDeadline: new Date(now.getTime() + 20000),
        },
        $push: { usedWords: word },
        $inc: { turnCount: 1 },
      },
      { new: true },
    );
    if (!updated) return invalid('TURN_EXPIRED');
    return [
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
      type: ArenaMatchType.FRIEND,
      friendMode: ArenaFriendMode.WORD_CHAIN,
      status: ArenaMatchStatus.PLAYING,
      chainPausedAt: null,
      turnDeadline: { $lte: new Date() },
    })) {
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
    return events;
  }
}
