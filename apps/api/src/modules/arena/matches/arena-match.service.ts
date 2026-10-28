import { Inject,Injectable,Optional } from '@nestjs/common';
import { arenaMatchXp } from '@repo/shared-types/learning-xp';
import { LearningActivityClient } from '../../../common/clients/learning-activity-client.js';
import { DomainOutboxService } from '../../../common/events/domain-outbox.service.js';
import { InjectPgConnection,createConnection,withPgTransaction,type PgConnection } from '../../../postgres/connection.js';
import { SqlRecords } from '../../../postgres/records.js';
import { literal,sql } from '../../../postgres/sql.js';
import type { LearningActivityWriter } from '../../learning-activity/learning-activity.service.js';
import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { ArenaSettingsService } from '../admin/arena-settings.service.js';
import {
FriendRoomSettings,
FriendRoomStatus
} from '../rows/friend-room.row.js';
import { ArenaMatchTransactions } from './arena-match-transactions.js';



import {
ArenaFriendMode,
ArenaMatchFinishReason,
ArenaMatchRow,
ArenaMatchStatus,
ArenaMatchType,
ArenaQuestionMode
} from '../rows/arena-match.row.js';


import { WsException } from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../../../common/redis/redis.service.js';
import { ArenaQuestionService } from '../question/arena-question.service.js';
import { ArenaRatingService } from '../rating/arena-rating.service.js';

export type ArenaStartResult =
  | { shouldStart: false; alreadyStarted: true }
  | { shouldStart: false; readyCount: number }
  | {
      shouldStart: true;
      match: ArenaMatchRow;
      questions: Awaited<
        ReturnType<ArenaQuestionService['createRankedQuestions']>
      >;
    };

@Injectable()
export class ArenaMatchService {
  private get arenaMatchModel(){return new SqlRecords(this.nativeDb,'arenamatches');}
private get arenaMatchPlayerModel(){return new SqlRecords(this.nativeDb,'arenamatchplayers');}
private get arenaProfileModel(){return new SqlRecords(this.nativeDb,'arenaprofiles');}
private get arenaRatingHistoryModel(){return new SqlRecords(this.nativeDb,'arenaratinghistories');}
private get friendRooms(){return new SqlRecords(this.nativeDb,'friendrooms');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,private readonly redisService: RedisService,
private readonly arenaQuestionService: ArenaQuestionService,
private readonly arenaRatingService: ArenaRatingService,
@Optional() private readonly settings?: ArenaSettingsService,
@Optional() @Inject(LearningActivityClient) private readonly learningActivity?: LearningActivityWriter,
@Optional() @Inject(DomainOutboxService) private readonly domainOutbox?: DomainOutboxService,
@Optional() private readonly transactions?: ArenaMatchTransactions
  ) {}

  /** Tạo một match 1v1 dùng chung cho rank, friend và room. */
  async createMatch(
    playerAId: string,
    playerBId: string,
    options: Parameters<ArenaMatchService['createUnlockedMatch']>[2] = {},
  ) {
    const redis = this.redisService.getClient();
    const token = randomUUID();
    const keys = [
      ...new Set([
        playerAId,
        playerBId,
        ...(options.additionalPlayerIds ?? []),
      ]),
    ]
      .sort()
      .map((id:any) => `arena:create-match:${id}`);
    const held: string[] = [];
    try {
      for (const key of keys) {
        if (!(await redis.set(key, token, { NX: true, PX: 30000 })))
          throw new WsException('Player is joining another match; try again');
        held.push(key);
      }
      return await this.createUnlockedMatch(playerAId, playerBId, options);
    } finally {
      for (const key of held)
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          { keys: [key], arguments: [token] },
        );
    }
  }

  private async createUnlockedMatch(
    playerAId: string,
    playerBId: string,
    options: {
      additionalPlayerIds?: string[];
      type?: ArenaMatchType;
      questionMode?: ArenaQuestionMode | null;
      roomCodeSnapshot?: string;
      settingsSnapshot?: FriendRoomSettings;
      questionCount?: number;
      secondsPerQuestion?: number;
      roomId?: string | null;
      friendMode?: ArenaFriendMode;
    } = {},
  ) {
    if (playerAId === playerBId)
      throw new WsException('Players must be different');
    if (
      (options.type === ArenaMatchType.FRIEND ||
        options.type === ArenaMatchType.ROOM) &&
      (!options.roomId || !options.settingsSnapshot)
    )
      throw new WsException('Use friend-room:start');
    const userIds = [
      playerAId,
      playerBId,
      ...(options.additionalPlayerIds ?? []),
    ];
    if (
      new Set(userIds).size !== userIds.length ||
      (options.type === ArenaMatchType.ROOM
        ? userIds.length < 3 || userIds.length > 8
        : userIds.length !== 2)
    )
      throw new WsException('INVALID_ROOM_CAPACITY');
    const active = await Promise.all(
      userIds.map((id:any) => this.findActiveMatchForUser(id)),
    );
    if (active.some(Boolean))
      throw new WsException('A player already has an active Arena match');

    const excluded=(options.type===ArenaMatchType.FRIEND||options.type===ArenaMatchType.ROOM)&&options.roomId?String(options.roomId):null;
    const occupiedRoom=await this.friendRooms.one(sql`id IS DISTINCT FROM ${excluded}::uuid AND (host_id=ANY(${userIds}::uuid[])
      OR guest_id=ANY(${userIds}::uuid[]) OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(members,'[]'::jsonb)) m WHERE m->>'userId'=ANY(${userIds}::text[])))`);
    if (occupiedRoom) throw new WsException('ALREADY_IN_ROOM');
    const playerAPgId = String(playerAId);
    const profiles = await Promise.all(
      userIds.map((id:any) =>
        this.arenaProfileModel.one(sql`("user_id" = ${String(id)})`),
      ),
    );
    if (profiles.some((profile) => !profile))
      throw new Error('Arena profile not found');

    const type = options.type ?? ArenaMatchType.RANK;
    const config = this.settings
      ? await this.settings.requireEnabled(type)
      : ARENA_DEFAULTS;
    const runtimePolicy = {
      hints: structuredClone(config.hints ?? ARENA_DEFAULTS.hints),
      ...(type === ArenaMatchType.RANK ? { rankedConnection: structuredClone(config.rankedConnection ?? ARENA_DEFAULTS.rankedConnection) } : {}),
      kFactor: config.ranked.kFactor,
      readyTimeout: config.ranked.readyTimeout,
      reconnectGrace:
        type === ArenaMatchType.RANK
          ? config.ranked.reconnectGrace
          : type === ArenaMatchType.ROOM
            ? config.group.reconnectGrace
            : config.friendly.reconnectGrace };
    return withPgTransaction(this.nativeDb,async db=>{
    const match = await new SqlRecords(db,'arenamatches').insert({
      audioSettings: structuredClone(config.audio),
      runtimePolicy,
      type: options.type ?? ArenaMatchType.RANK,
      status:
        (options.type === ArenaMatchType.FRIEND ||
          options.type === ArenaMatchType.ROOM) &&
        !options.roomId
          ? ArenaMatchStatus.WAITING
          : ArenaMatchStatus.COUNTDOWN,
      friendMode: options.friendMode ?? null,
      hostId:
        options.type === ArenaMatchType.FRIEND ||
        options.type === ArenaMatchType.ROOM
          ? playerAPgId
          : null,

      roomId: options.roomId ?? null,

      roomCodeSnapshot: options.roomCodeSnapshot,
      settingsSnapshot: options.settingsSnapshot,
      questionMode:
        options.friendMode === ArenaFriendMode.WORD_CHAIN ||
        options.friendMode === ArenaFriendMode.WORD_GUESS
          ? null
          : (options.questionMode ?? ArenaQuestionMode.MEANING_TO_WORD),
      questionCount: options.questionCount ?? config.ranked.questionCount,
      currentQuestionIndex: 1,
      secondsPerQuestion:
        options.secondsPerQuestion ?? config.ranked.timePerQuestion,

      startedAt: null,
      finishedAt: null,

      winnerId: null,
      isDraw: false });

    const players=await Promise.all(userIds.map((id,index)=>new SqlRecords(db,'arenamatchplayers').insert({
      matchId:match._id,userId:String(id),ratingBefore:profiles[index]!.rating,ratingAfter:profiles[index]!.rating,ratingChange:0,
      isReady:false,readyAt:null,score:0,correctAnswers:0,wrongAnswers:0,unanswered:0,
    })));

    return {
      match,
      players };
    });
  }

  /** Giữ API tương thích cho matchmaking ranked hiện tại. */
  async createRankedMatch(playerAId: string, playerBId: string) {
    return this.createMatch(playerAId, playerBId);
  }

  /**
   * Atomically finalizes a ranked match and applies its Elo result exactly once.
   * The FINISHING lock prevents the server clock and a player request from
   * updating profiles or rating history twice.
   */
  async finishMatch(
    matchId: string,
    finishReason: ArenaMatchFinishReason = ArenaMatchFinishReason.NORMAL,
    winnerUserId?: string,
    expectedTurnCount?: number,
  ) {
    if (this.transactions) return this.transactions.run(matchId, () => this.finishLocked(matchId, finishReason, winnerUserId, expectedTurnCount));
    return this.finishLocked(matchId, finishReason, winnerUserId, expectedTurnCount);
  }
  private async finishLocked(matchId: string, finishReason: ArenaMatchFinishReason, winnerUserId?: string, expectedTurnCount?: number) {
    const uuid = String(matchId);
    const match=await this.arenaMatchModel.patch(sql`id=${uuid}::uuid AND status=ANY(${[ArenaMatchStatus.PLAYING,ArenaMatchStatus.PAUSED,ArenaMatchStatus.RESUMING]}::text[])
      AND (${expectedTurnCount===undefined}::boolean OR (turn_count=${expectedTurnCount??null} AND chain_paused_at IS NULL AND turn_deadline<=${new Date()}))`,
      {status:ArenaMatchStatus.FINISHING,finishReason});

    if (!match) {
      const existing = await this.arenaMatchModel.one(sql`id=${uuid}::uuid`);
      return existing?.status === ArenaMatchStatus.FINISHED ? existing : null;
    }

    const players = await this.arenaMatchPlayerModel.select(sql`("match_id" = ${uuid})`, sql`ORDER BY "score" DESC NULLS LAST,"user_id" ASC NULLS FIRST`);
    if (players.length < 2) {
      await this.arenaMatchModel.patch(sql`("id" = ${uuid}) AND ("status" = ${ArenaMatchStatus.FINISHING})`,{
            status: ArenaMatchStatus.CANCELLED,
            cancelReason: 'Insufficient players' });
      return null;
    }

    if (match.type === ArenaMatchType.ROOM)
      players.sort(
        (a, b) =>
          Number(
            (match.eliminatedUserIds ?? []).some(
              (id:any) => String(id) === String(a.userId),
            ),
          ) -
          Number(
            (match.eliminatedUserIds ?? []).some(
              (id:any) => String(id) === String(b.userId),
            ),
          ),
      );
    const [playerA, playerB] = players;
    const forcedWinner = winnerUserId
      ? players.findIndex((player) => String(player.userId) === winnerUserId)
      : -1;
    const isDraw =
      forcedWinner < 0 &&
      playerA.score === playerB.score &&
      !(match.eliminatedUserIds ?? []).some(
        (id:any) => String(id) === String(playerB.userId),
      );
    const winner: 'A' | 'B' | 'DRAW' = isDraw
      ? 'DRAW'
      : forcedWinner === 1
        ? 'B'
        : 'A';
    const rating =
      match.type === ArenaMatchType.RANK
        ? this.arenaRatingService.calculateMatch(
            playerA.ratingBefore,
            playerB.ratingBefore,
            winner,
            match.runtimePolicy?.kFactor,
          )
        : {
            playerA: {
              ratingBefore: playerA.ratingBefore,
              ratingAfter: playerA.ratingBefore,
              ratingChange: 0 },
            playerB: {
              ratingBefore: playerB.ratingBefore,
              ratingAfter: playerB.ratingBefore,
              ratingChange: 0 } };
    const now = new Date();
    const winningPlayer = isDraw
      ? null
      : players[forcedWinner >= 0 ? forcedWinner : 0];
    const results = players.map((player, index) => ({
      player,
      rating:
        match.type === ArenaMatchType.RANK
          ? index === 0
            ? rating.playerA
            : rating.playerB
          : {
              ratingBefore: player.ratingBefore,
              ratingAfter: player.ratingBefore,
              ratingChange: 0 },
      won: player === winningPlayer }));

    if (!this.domainOutbox) throw new Error('Transactional outbox not configured');
    const finished = await this.domainOutbox.withTransaction(async (session) => {
      const db=createConnection(session.client as any),model=new SqlRecords(db,'arenamatches'),txProfiles=new SqlRecords(db,'arenaprofiles'),
        txPlayers=new SqlRecords(db,'arenamatchplayers'),txHistory=new SqlRecords(db,'arenaratinghistories');
      for(const result of results){
        if(match.type===ArenaMatchType.RANK){
          const streak=result.won?sql`COALESCE(current_win_streak,0)+1`:literal('0');
          await txProfiles.patch(sql`user_id=${String(result.player.userId)}::uuid`,{rating:result.rating.ratingAfter},{
            currentWinStreak:streak,bestWinStreak:sql`GREATEST(COALESCE(best_win_streak,0),${streak})`,
            rankedMatches:sql`COALESCE(ranked_matches,0)+1`,rankedWins:sql`COALESCE(ranked_wins,0)+${result.won?1:0}`,
            rankedLosses:sql`COALESCE(ranked_losses,0)+${!isDraw&&!result.won?1:0}`,rankedDraws:sql`COALESCE(ranked_draws,0)+${isDraw?1:0}`,
          });
        }
        await txPlayers.patch(sql`id=${String(result.player._id)}::uuid`,{ratingAfter:result.rating.ratingAfter,ratingChange:result.rating.ratingChange,status:'FINISHED',finishedAt:now});
        if(match.type===ArenaMatchType.RANK)await txHistory.insert({matchId:uuid,userId:String(result.player.userId),before:result.rating.ratingBefore,
          after:result.rating.ratingAfter,change:result.rating.ratingChange},['match_id','user_id']);
      }
      const saved=await model.patch(sql`id=${uuid}::uuid AND status=${ArenaMatchStatus.FINISHING}`,{
        status:ArenaMatchStatus.FINISHED,finishedAt:now,isDraw,winnerId:winningPlayer?.userId??null,
      });
      if (saved) for (const result of results) {
        await this.domainOutbox!.enqueue('learning.activity.recorded.v1', String(result.player.userId), {
          userId:String(result.player.userId),module:'ARENA',type:'ARENA_MATCH',
          sourceKey:`arena:${matchId}`,xp:arenaMatchXp(result.won),occurredAt:now,
          refId:matchId,link:'/arena',correct:result.player.correctAnswers,
          total:(result.player.correctAnswers??0)+(result.player.wrongAnswers??0)+
            (result.player.unanswered??0),score:result.player.score,
          durationSec:match.startedAt?Math.max(0,Math.round((now.getTime()-match.startedAt.getTime())/1000)):undefined,
          metadata:{matchType:match.type,won:result.won,isDraw,ratingChange:result.rating.ratingChange},
          sourceService:'arena',
        },session);
      }
      return saved;
    });
    if (
      finished &&
      (match.type === ArenaMatchType.FRIEND ||
        match.type === ArenaMatchType.ROOM) &&
      match.roomId
    )
      await this.friendRooms.patch(sql`id=${match.roomId}::uuid AND current_match_id=${uuid}::uuid`,{
        status:FriendRoomStatus.WAITING,currentMatchId:null,guestReady:false,
      },{revision:sql`COALESCE(revision,0)+1`,...(match.type===ArenaMatchType.ROOM?{
        members:sql`(SELECT COALESCE(jsonb_agg(m||jsonb_build_object('isReady',false) ORDER BY ordinality),'[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(members,'[]'::jsonb)) WITH ORDINALITY entry(m,ordinality))`,
      }:{})});
    return finished;
  }

  /** Compat alias cho các caller ranked hiện tại. */
  async finishRankedMatch(
    matchId: string,
    finishReason: ArenaMatchFinishReason = ArenaMatchFinishReason.NORMAL,
    winnerUserId?: string,
  ) {
    return this.finishMatch(matchId, finishReason, winnerUserId);
  }

  /** Trả về trận COUNTDOWN/PLAYING hiện tại của người dùng nếu có. */
  async findActiveMatchForUser(userId: string) {
    return this.arenaMatchModel.one(sql`status=ANY(${[ArenaMatchStatus.WAITING,ArenaMatchStatus.COUNTDOWN,ArenaMatchStatus.PLAYING,
      ArenaMatchStatus.PAUSED,ArenaMatchStatus.RESUMING,ArenaMatchStatus.FINISHING]}::text[]) AND id IN
      (SELECT match_id FROM public.arenamatchplayers WHERE user_id=${userId}::uuid AND status IN('PLAYING','DISCONNECTED'))`);
  }

  /** Đánh dấu disconnect sau khi xác nhận user không còn socket Arena nào. */
  async markDisconnected(userId: string) {
    const match = await this.findActiveMatchForUser(userId);
    if (!match) return;
    if (
      match.friendMode === ArenaFriendMode.WORD_CHAIN &&
      (match.type !== ArenaMatchType.ROOM ||
        String(match.currentTurnUserId) === userId) &&
      match.status === ArenaMatchStatus.PLAYING
    ) {
      await this.arenaMatchModel.patch(sql`("id" = ${match._id}) AND ("status" = ${ArenaMatchStatus.PLAYING}) AND ("chain_paused_at" IS NULL) AND ("turn_deadline" > ${new Date()})`,{ chainPausedAt: new Date() });
    }
    return this.arenaMatchPlayerModel.patch(sql`match_id=${match._id}::uuid AND user_id=${userId}::uuid AND status='PLAYING'`,{status:'DISCONNECTED',disconnectedAt:new Date()});
  }

  /** Khôi phục player sau khi socket mới xác thực và vào lại trận. */
  async markReconnected(matchId: string, userId: string) {
    const current = await this.arenaMatchModel.one(sql`id=${matchId}::uuid`);
    if (current?.type === ArenaMatchType.RANK) return;
    const player = await this.arenaMatchPlayerModel.one(sql`("match_id" = ${String(matchId)}) AND ("user_id" = ${String(userId)}) AND ("status" = ${'DISCONNECTED'})`);
    if (
      player?.disconnectedAt &&
      Date.now() - player.disconnectedAt.getTime() >= 20000
    )
      throw new WsException('Reconnect grace period expired');
    const result=await this.arenaMatchPlayerModel.patch(sql`match_id=${matchId}::uuid AND user_id=${userId}::uuid AND status='DISCONNECTED'`,{status:'PLAYING',disconnectedAt:null});
    const match = await this.arenaMatchModel.one(sql`id=${matchId}::uuid`);
    if (
      match?.chainPausedAt &&
      match.turnDeadline &&
      !await this.arenaMatchPlayerModel.one(sql`match_id=${match._id}::uuid AND status='DISCONNECTED'
        AND (${match.type!==ArenaMatchType.ROOM}::boolean OR user_id=${match.currentTurnUserId??null}::uuid)`)

    ) {
      await this.arenaMatchModel.patch(sql`("id" = ${match._id}) AND ("status" = ${ArenaMatchStatus.PLAYING}) AND ("chain_paused_at" = ${match.chainPausedAt})`,{
            turnDeadline: new Date(
              match.turnDeadline.getTime() +
                Date.now() -
                match.chainPausedAt.getTime(),
            ),
            chainPausedAt: null });
    }
    return result;
  }

  /**
   * Xử lý timeout của countdown và disconnect grace period.
   * Trả về các match vừa được finalize để gateway broadcast kết quả.
   */
  async processLifecycle(now = new Date()): Promise<string[]> {
    const readyDeadline = new Date(now.getTime() - 5_000);
    const countdownMatches = await this.arenaMatchModel.select(sql`("status" = ${ArenaMatchStatus.COUNTDOWN}) AND ("type" = ${ArenaMatchType.RANK}) AND ("created_at" <= ${readyDeadline})`);
    for (const match of countdownMatches) {
      if (
        match.createdAt.getTime() +
          (match.runtimePolicy?.readyTimeout ?? 30) * 1000 >
        now.getTime()
      )
        continue;
      const cancelled=await this.arenaMatchModel.patch(sql`id=${match._id}::uuid AND status=${ArenaMatchStatus.COUNTDOWN}`,{status:ArenaMatchStatus.CANCELLED,cancelReason:'Ready timeout'});
      if (cancelled)
        await this.arenaMatchPlayerModel.patch(sql`("match_id" = ${match._id})`,{ status: 'LEFT' });
    }

    const disconnected = await this.arenaMatchPlayerModel.select(sql`("status" = ${'DISCONNECTED'}) AND ("disconnected_at" <= ${new Date(now.getTime() - 5_000)})`);
    const finished: string[] = [];
    for (const player of disconnected) {
      const match = await this.arenaMatchModel.one(sql`("id" = ${player.matchId}) AND ("status"=ANY(${[ArenaMatchStatus.PLAYING, ArenaMatchStatus.WAITING]}::text[]))`);
      if (!match || match.type === ArenaMatchType.ROOM || match.type === ArenaMatchType.RANK) continue;
      if (
        player.disconnectedAt &&
        player.disconnectedAt.getTime() +
          (match.runtimePolicy?.reconnectGrace ?? 20) * 1000 >
          now.getTime()
      )
        continue;
      if (match.status === ArenaMatchStatus.WAITING) {
        await this.arenaMatchModel.patch(sql`("id" = ${match._id}) AND ("status" = ${ArenaMatchStatus.WAITING})`,{
              status: ArenaMatchStatus.CANCELLED,
              cancelReason: 'Reconnect timeout in lobby' });
        await this.arenaMatchPlayerModel.patch(sql`("match_id" = ${match._id})`,{ status: 'LEFT' });
        finished.push(String(match._id));
        continue;
      }
      const opponent = await this.getOpponentUserId(
        String(match._id),
        String(player.userId),
      );
      const result = await this.finishMatch(
        String(match._id),
        ArenaMatchFinishReason.DISCONNECT_TIMEOUT,
        opponent ?? undefined,
      );
      if (result) finished.push(String(match._id));
    }
    return finished;
  }

  /** Lấy user còn lại trong một trận để xử lý forfeit. */
  async nextRoomPlayer(
    matchId: string,
    userId: string,
    excluded: string[] = [],
  ) {
    const match = await this.arenaMatchModel.one(sql`id=${String(matchId)}::uuid`);
    const players = await this.arenaMatchPlayerModel.select(sql`("match_id" = ${String(matchId)})`, sql`ORDER BY "id" ASC NULLS FIRST`);
    const removed = [
      ...(match?.eliminatedUserIds ?? []).map(String),
      ...excluded,
    ];
    const index = players.findIndex((p) => String(p.userId) === userId);
    for (let offset = 1; offset <= players.length; offset++) {
      const player = players[(index + offset) % players.length];
      if (
        player &&
        String(player.userId) !== userId &&
        !removed.includes(String(player.userId))
      )
        return String(player.userId);
    }
    return null;
  }

  // A timed-out/forfeiting Room player drops out; the remaining players keep playing.
  async dropRoomPlayer(
    matchId: string,
    userId: string,
    reason: ArenaMatchFinishReason,
    expectedTurnCount?: number,
  ) {
    const uuid = String(matchId);
    for (let attempt = 0; attempt < 8; attempt++) {
      const match = await this.arenaMatchModel.one(sql`id=${uuid}::uuid`);
      if (
        !match ||
        match.type !== ArenaMatchType.ROOM ||
        match.status !== ArenaMatchStatus.PLAYING
      )
        return null;
      if ((match.eliminatedUserIds ?? []).some((id:any) => String(id) === userId))
        return null;
      const players = await this.arenaMatchPlayerModel.select(sql`("match_id" = ${uuid})`, sql`ORDER BY "id" ASC NULLS FIRST`);
      if (!players.some((p) => String(p.userId) === userId))
        throw new WsException('NOT_ROOM_GUEST');
      const eliminated = [
        ...(match.eliminatedUserIds ?? []),
        String(userId),
      ];
      const remaining = players.filter(
        (p) => !eliminated.some((id:any) => String(id) === String(p.userId)),
      );
      const next = await this.nextRoomPlayer(matchId, userId, [userId]);
      const switchTurn = String(match.currentTurnUserId) === userId;
      const now = new Date();
      const changed=await this.arenaMatchModel.patch(sql`id=${uuid}::uuid AND status=${ArenaMatchStatus.PLAYING}
        AND turn_count=${expectedTurnCount??match.turnCount} AND room_revision=${match.roomRevision??0}
        AND (${expectedTurnCount===undefined}::boolean OR (chain_paused_at IS NULL AND turn_deadline<=${now}))`,{
          eliminatedUserIds:eliminated,...(switchTurn&&next?{currentTurnUserId:String(next),turnStartedAt:now,
            turnDeadline:new Date(now.getTime()+(match.settingsSnapshot?.turnTime??20)*1000),chainPausedAt:null}:{}),
        },{roomRevision:sql`COALESCE(room_revision,0)+1`});
      if (!changed) {
        if (expectedTurnCount !== undefined) return null;
        continue;
      }
      await this.arenaMatchPlayerModel.patch(sql`("match_id" = ${uuid}) AND ("user_id" = ${String(userId)})`,{ status: 'LEFT', disconnectedAt: null });
      if (remaining.length <= 1)
        return this.finishMatch(
          matchId,
          reason,
          remaining[0] ? String(remaining[0].userId) : undefined,
        );
      if (
        match.friendMode === ArenaFriendMode.WORD_GUESS &&
        remaining.every(
          (p) =>
            (match.wordGuessAttempts ?? []).filter(
              (a:any) => a.userId === String(p.userId),
            ).length >= 5,
        )
      )
        return this.finishMatch(matchId, ArenaMatchFinishReason.NORMAL);
      return null;
    }
    throw new WsException('ROOM_IN_MATCH');
  }

  async getOpponentUserId(matchId: string, userId: string) {
    const opponent = await this.arenaMatchPlayerModel.one(sql`("match_id" = ${String(matchId)}) AND ("user_id" IS DISTINCT FROM ${String(userId)})`);
    return opponent ? String(opponent.userId) : null;
  }

  /** Đánh dấu người chơi sẵn sàng và bắt đầu trận khi đủ hai người. */
  async markReady(matchId: string, userId: string): Promise<ArenaStartResult> {
    if (this.transactions) return this.transactions.run(matchId, () => this.markReadyLocked(matchId, userId));
    return this.markReadyLocked(matchId, userId);
  }
  private async markReadyLocked(matchId: string, userId: string): Promise<ArenaStartResult> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))
      throw new WsException('Invalid match or player ID');
    const matchPgId = String(matchId);

    const userPgId = String(userId);

    /*
     * 1. Kiểm tra match
     */
    const match = await this.arenaMatchModel.one(sql`id=${matchPgId}::uuid`);

    // Match không tồn tại thì không thể tiếp tục quy trình ready.
    if (!match) {
      throw new WsException('Match not found');
    }
    if (
      match.type === ArenaMatchType.FRIEND ||
      match.type === ArenaMatchType.ROOM
    )
      throw new WsException('Friendly matches require host Start');

    const member = await this.arenaMatchPlayerModel.one(sql`("match_id" = ${matchPgId}) AND ("user_id" = ${userPgId})`);
    // Chặn user không thuộc trận gửi yêu cầu ready giả mạo.
    if (!member) throw new WsException('You are not a player in this match');

    /*
     * Nếu trận đã chạy rồi
     * thì không ready lại nữa.
     */
    // Request lặp lại sau khi trận đã chạy chỉ cần trả trạng thái hiện tại.
    if (match.status === ArenaMatchStatus.PLAYING) {
      return {
        shouldStart: false,
        alreadyStarted: true };
    }

    if (match.status !== ArenaMatchStatus.COUNTDOWN) {
      throw new WsException('Match is not waiting for players');
    }

    /*
     * 2. Đánh dấu player ready
     */
    const player = await this.arenaMatchPlayerModel.patch(sql`("match_id" = ${matchPgId}) AND ("user_id" = ${userPgId})`,{
          isReady: true,
          readyAt: new Date() });

    if (!player) {
      throw new WsException('You are not a player in this match');
    }

    /*
     * 3. Kiểm tra bao nhiêu người ready
     */
    const readyCount = await this.arenaMatchPlayerModel.count(sql`("match_id" = ${matchPgId}) AND ("is_ready" = ${true})`);

    // Chờ người chơi còn lại ready trước khi sinh câu hỏi.
    if (readyCount < 2) {
      return {
        shouldStart: false,
        readyCount };
    }

    /*
     * 4. Đủ 2 người thì start
     */
    return this.startRankedMatch(matchId);
  }

  /** Chuyển match sang PLAYING một cách atomic và tạo bộ câu hỏi. */
  async startRankedMatch(matchId: string): Promise<ArenaStartResult> {
    /*
     * Quan trọng:
     * chỉ update nếu status còn COUNTDOWN.
     *
     * Như vậy nếu 2 request ready chạy gần
     * như cùng lúc thì chỉ 1 request thắng.
     */
    const match = await this.arenaMatchModel.patch(sql`("id" = ${String(matchId)}) AND ("status" = ${ArenaMatchStatus.COUNTDOWN}) AND ("type" = ${ArenaMatchType.RANK})`,{
          status: ArenaMatchStatus.PLAYING,

          startedAt: new Date() });

    /*
     * Nếu null:
     * request khác đã start match trước rồi.
     */
    // Null nghĩa là request khác đã thắng điều kiện update và start trước.
    if (!match) {
      return {
        shouldStart: false,
        alreadyStarted: true };
    }

    /*
     * Tạo câu hỏi cho trận.
     */
    let questions: Awaited<
      ReturnType<ArenaQuestionService['createRankedQuestions']>
    >;
    try {
      questions = await this.arenaQuestionService.createRankedQuestions(
        matchId,
        match.questionCount,
      );
    } catch (error) {
      // Rollback trạng thái để có thể thử tạo câu hỏi lại nếu quá trình sinh đề lỗi.
      await this.arenaMatchModel.patch(sql`("id" = ${match._id}) AND ("status" = ${ArenaMatchStatus.PLAYING}) AND ("started_at" = ${match.startedAt})`,{ status: ArenaMatchStatus.COUNTDOWN, startedAt: null });
      throw error;
    }

    return {
      shouldStart: true,
      match,
      questions };
  }
}
