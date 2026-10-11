import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  ArenaMatch,
  ArenaMatchDocument,
  ArenaMatchFinishReason,
  ArenaMatchStatus,
  ArenaMatchType,
  ArenaQuestionMode,
} from '../schemas/arena-match.schema.js';

import {
  ArenaMatchPlayer,
  ArenaMatchPlayerDocument,
} from '../schemas/arena-match-player.schema.js';

import {
  ArenaProfile,
  ArenaProfileDocument,
} from '../schemas/arena-profile.schema.js';
import { WsException } from '@nestjs/websockets';
import { ArenaQuestionService } from '../question/arena-question.service.js';
import {
  ArenaRatingHistory,
  ArenaRatingHistoryDocument,
} from '../schemas/arena-rating-history.schema.js';
import { ArenaRatingService } from '../rating/arena-rating.service.js';

export type ArenaStartResult =
  | { shouldStart: false; alreadyStarted: true }
  | { shouldStart: false; readyCount: number }
  | {
      shouldStart: true;
      match: ArenaMatchDocument;
      questions: Awaited<
        ReturnType<ArenaQuestionService['createRankedQuestions']>
      >;
    };

@Injectable()
export class ArenaMatchService {
  constructor(
    @InjectModel(ArenaMatch.name)
    private readonly arenaMatchModel: Model<ArenaMatchDocument>,

    @InjectModel(ArenaMatchPlayer.name)
    private readonly arenaMatchPlayerModel: Model<ArenaMatchPlayerDocument>,

    @InjectModel(ArenaProfile.name)
    private readonly arenaProfileModel: Model<ArenaProfileDocument>,

    @InjectModel(ArenaRatingHistory.name)
    private readonly arenaRatingHistoryModel: Model<ArenaRatingHistoryDocument>,

    private readonly arenaQuestionService: ArenaQuestionService,
    private readonly arenaRatingService: ArenaRatingService,
  ) {}

  /** Tạo một match 1v1 dùng chung cho rank, friend và room. */
  async createMatch(
    playerAId: string,
    playerBId: string,
    options: {
      type?: ArenaMatchType;
      questionMode?: ArenaQuestionMode;
      questionCount?: number;
      secondsPerQuestion?: number;
      roomId?: Types.ObjectId | null;
    } = {},
  ) {
    if (playerAId === playerBId)
      throw new WsException('Players must be different');
    const [activeA, activeB] = await Promise.all([
      this.findActiveMatchForUser(playerAId),
      this.findActiveMatchForUser(playerBId),
    ]);
    if (activeA || activeB)
      throw new WsException('A player already has an active Arena match');

    const playerAObjectId = new Types.ObjectId(playerAId);
    const playerBObjectId = new Types.ObjectId(playerBId);

    const [profileA, profileB] = await Promise.all([
      this.arenaProfileModel.findOne({
        userId: playerAObjectId,
      }),

      this.arenaProfileModel.findOne({
        userId: playerBObjectId,
      }),
    ]);

    // Không thể tạo trận nếu một người chưa có Arena profile.
    if (!profileA || !profileB) {
      throw new Error('Arena profile not found');
    }

    const match = await this.arenaMatchModel.create({
      type: options.type ?? ArenaMatchType.RANK,
      status: ArenaMatchStatus.COUNTDOWN,

      roomId: options.roomId ?? null,

      questionMode: options.questionMode ?? ArenaQuestionMode.MEANING_TO_WORD,
      questionCount: options.questionCount ?? 10,
      currentQuestionIndex: 1,
      secondsPerQuestion: options.secondsPerQuestion ?? 30,

      startedAt: null,
      finishedAt: null,

      winnerId: null,
      isDraw: false,
    });

    const players = await this.arenaMatchPlayerModel.insertMany([
      {
        matchId: match._id,
        userId: playerAObjectId,

        ratingBefore: profileA.rating,
        ratingAfter: profileA.rating,
        ratingChange: 0,

        isReady: false,
        readyAt: null,

        score: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        unanswered: 0,
      },

      {
        matchId: match._id,
        userId: playerBObjectId,

        ratingBefore: profileB.rating,
        ratingAfter: profileB.rating,
        ratingChange: 0,

        isReady: false,
        readyAt: null,

        score: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        unanswered: 0,
      },
    ]);

    return {
      match,
      players,
    };
  }

  /** Giữ API tương thích cho matchmaking ranked hiện tại. */
  async createRankedMatch(playerAId: string, playerBId: string) {
    return this.createMatch(playerAId, playerBId);
  }

  /** Tạo duel bạn bè trên cùng lifecycle với ranked nhưng không đổi Elo. */
  async createFriendMatch(playerAId: string, playerBId: string) {
    return this.createMatch(playerAId, playerBId, {
      type: ArenaMatchType.FRIEND,
      questionCount: 10,
      secondsPerQuestion: 30,
    });
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
  ) {
    const objectId = new Types.ObjectId(matchId);
    const match = await this.arenaMatchModel.findOneAndUpdate(
      { _id: objectId, status: ArenaMatchStatus.PLAYING },
      { $set: { status: ArenaMatchStatus.FINISHING, finishReason } },
      { new: true },
    );

    if (!match) {
      const existing = await this.arenaMatchModel.findById(objectId);
      return existing?.status === ArenaMatchStatus.FINISHED ? existing : null;
    }

    const players = await this.arenaMatchPlayerModel
      .find({ matchId: objectId })
      .sort({ score: -1, userId: 1 });
    if (players.length < 2) {
      await this.arenaMatchModel.updateOne(
        { _id: objectId, status: ArenaMatchStatus.FINISHING },
        {
          $set: {
            status: ArenaMatchStatus.CANCELLED,
            cancelReason: 'Insufficient players',
          },
        },
      );
      return null;
    }

    const [playerA, playerB] = players;
    const forcedWinner = winnerUserId
      ? players.findIndex((player) => String(player.userId) === winnerUserId)
      : -1;
    const isDraw = forcedWinner < 0 && playerA.score === playerB.score;
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
          )
        : {
            playerA: {
              ratingBefore: playerA.ratingBefore,
              ratingAfter: playerA.ratingBefore,
              ratingChange: 0,
            },
            playerB: {
              ratingBefore: playerB.ratingBefore,
              ratingAfter: playerB.ratingBefore,
              ratingChange: 0,
            },
          };
    const now = new Date();
    const results = [
      { player: playerA, rating: rating.playerA, won: winner === 'A' },
      { player: playerB, rating: rating.playerB, won: winner === 'B' },
    ];

    for (const result of results) {
      if (match.type === ArenaMatchType.RANK) {
        const profile = await this.arenaProfileModel.findOne({
          userId: result.player.userId,
        });
        const currentStreak = result.won
          ? (profile?.currentWinStreak ?? 0) + 1
          : 0;
        await this.arenaProfileModel.updateOne(
          { userId: result.player.userId },
          {
            $set: {
              rating: result.rating.ratingAfter,
              currentWinStreak: currentStreak,
              bestWinStreak: Math.max(
                profile?.bestWinStreak ?? 0,
                currentStreak,
              ),
            },
            $inc: {
              rankedMatches: 1,
              rankedWins: result.won ? 1 : 0,
              rankedLosses: !isDraw && !result.won ? 1 : 0,
              rankedDraws: isDraw ? 1 : 0,
            },
          },
        );
      }
      await this.arenaMatchPlayerModel.updateOne(
        { _id: result.player._id },
        {
          $set: {
            ratingAfter: result.rating.ratingAfter,
            ratingChange: result.rating.ratingChange,
            status: 'FINISHED',
            finishedAt: now,
          },
        },
      );
      if (match.type === ArenaMatchType.RANK) {
        await this.arenaRatingHistoryModel.updateOne(
          { matchId: objectId, userId: result.player.userId },
          {
            $setOnInsert: {
              matchId: objectId,
              userId: result.player.userId,
              before: result.rating.ratingBefore,
              after: result.rating.ratingAfter,
              change: result.rating.ratingChange,
            },
          },
          { upsert: true },
        );
      }
    }

    return this.arenaMatchModel.findOneAndUpdate(
      { _id: objectId, status: ArenaMatchStatus.FINISHING },
      {
        $set: {
          status: ArenaMatchStatus.FINISHED,
          finishedAt: now,
          isDraw,
          winnerId: isDraw
            ? null
            : winner === 'B'
              ? playerB.userId
              : playerA.userId,
        },
      },
      { new: true },
    );
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
    const player = await this.arenaMatchPlayerModel.findOne({
      userId: new Types.ObjectId(userId),
      status: { $in: ['PLAYING', 'DISCONNECTED'] },
    });
    if (!player) return null;
    return this.arenaMatchModel.findOne({
      _id: player.matchId,
      status: {
        $in: [
          ArenaMatchStatus.COUNTDOWN,
          ArenaMatchStatus.PLAYING,
          ArenaMatchStatus.FINISHING,
        ],
      },
    });
  }

  /** Đánh dấu disconnect sau khi xác nhận user không còn socket Arena nào. */
  async markDisconnected(userId: string) {
    return this.arenaMatchPlayerModel.updateOne(
      {
        userId: new Types.ObjectId(userId),
        status: 'PLAYING',
      },
      { $set: { status: 'DISCONNECTED', disconnectedAt: new Date() } },
    );
  }

  /** Khôi phục player sau khi socket mới xác thực và vào lại trận. */
  async markReconnected(matchId: string, userId: string) {
    return this.arenaMatchPlayerModel.updateOne(
      {
        matchId: new Types.ObjectId(matchId),
        userId: new Types.ObjectId(userId),
        status: 'DISCONNECTED',
      },
      { $set: { status: 'PLAYING', disconnectedAt: null } },
    );
  }

  /**
   * Xử lý timeout của countdown và disconnect grace period.
   * Trả về các match vừa được finalize để gateway broadcast kết quả.
   */
  async processLifecycle(now = new Date()): Promise<string[]> {
    const readyDeadline = new Date(now.getTime() - 30_000);
    const countdownMatches = await this.arenaMatchModel.find({
      status: ArenaMatchStatus.COUNTDOWN,
      createdAt: { $lte: readyDeadline },
    });
    for (const match of countdownMatches) {
      await this.arenaMatchModel.updateOne(
        { _id: match._id, status: ArenaMatchStatus.COUNTDOWN },
        {
          $set: {
            status: ArenaMatchStatus.CANCELLED,
            cancelReason: 'Ready timeout',
          },
        },
      );
    }

    const disconnected = await this.arenaMatchPlayerModel.find({
      status: 'DISCONNECTED',
      disconnectedAt: { $lte: new Date(now.getTime() - 20_000) },
    });
    const finished: string[] = [];
    for (const player of disconnected) {
      const match = await this.arenaMatchModel.findOne({
        _id: player.matchId,
        status: ArenaMatchStatus.PLAYING,
      });
      if (!match) continue;
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
  async getOpponentUserId(matchId: string, userId: string) {
    const opponent = await this.arenaMatchPlayerModel.findOne({
      matchId: new Types.ObjectId(matchId),
      userId: { $ne: new Types.ObjectId(userId) },
    });
    return opponent ? String(opponent.userId) : null;
  }

  /** Đánh dấu người chơi sẵn sàng và bắt đầu trận khi đủ hai người. */
  async markReady(matchId: string, userId: string): Promise<ArenaStartResult> {
    if (!/^[a-f\d]{24}$/i.test(matchId) || !/^[a-f\d]{24}$/i.test(userId))
      throw new WsException('Invalid match or player ID');
    const matchObjectId = new Types.ObjectId(matchId);

    const userObjectId = new Types.ObjectId(userId);

    /*
     * 1. Kiểm tra match
     */
    const match = await this.arenaMatchModel.findById(matchObjectId);

    // Match không tồn tại thì không thể tiếp tục quy trình ready.
    if (!match) {
      throw new WsException('Match not found');
    }

    const member = await this.arenaMatchPlayerModel.exists({
      matchId: matchObjectId,
      userId: userObjectId,
    });
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
        alreadyStarted: true,
      };
    }

    if (match.status !== ArenaMatchStatus.COUNTDOWN) {
      throw new WsException('Match is not waiting for players');
    }

    /*
     * 2. Đánh dấu player ready
     */
    const player = await this.arenaMatchPlayerModel.findOneAndUpdate(
      {
        matchId: matchObjectId,

        userId: userObjectId,
      },
      {
        $set: {
          isReady: true,
          readyAt: new Date(),
        },
      },
      {
        new: true,
      },
    );

    if (!player) {
      throw new WsException('You are not a player in this match');
    }

    /*
     * 3. Kiểm tra bao nhiêu người ready
     */
    const readyCount = await this.arenaMatchPlayerModel.countDocuments({
      matchId: matchObjectId,

      isReady: true,
    });

    // Chờ người chơi còn lại ready trước khi sinh câu hỏi.
    if (readyCount < 2) {
      return {
        shouldStart: false,
        readyCount,
      };
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
    const match = await this.arenaMatchModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(matchId),

        status: ArenaMatchStatus.COUNTDOWN,
      },
      {
        $set: {
          status: ArenaMatchStatus.PLAYING,

          startedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );

    /*
     * Nếu null:
     * request khác đã start match trước rồi.
     */
    // Null nghĩa là request khác đã thắng điều kiện update và start trước.
    if (!match) {
      return {
        shouldStart: false,
        alreadyStarted: true,
      };
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
      await this.arenaMatchModel.updateOne(
        {
          _id: match._id,
          status: ArenaMatchStatus.PLAYING,
          startedAt: match.startedAt,
        },
        { $set: { status: ArenaMatchStatus.COUNTDOWN, startedAt: null } },
      );
      throw error;
    }

    return {
      shouldStart: true,
      match,
      questions,
    };
  }
}
