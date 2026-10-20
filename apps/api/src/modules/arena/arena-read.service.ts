import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import {
  ArenaMatch,
  ArenaMatchStatus,
  ArenaMatchType,
} from './schemas/arena-match.schema.js';
import { ArenaMatchPlayer } from './schemas/arena-match-player.schema.js';
import { ArenaProfile } from './schemas/arena-profile.schema.js';
import { User } from '../users/schema/user.schema.js';

export type ArenaRankingPeriod = 'week' | 'month' | 'all';
export type ArenaRankingEntry = {
  userId: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  matches: number;
  wins: number;
  position: number;
};
export type ArenaRecentMatch = {
  id: string;
  name: string;
  avatarUrl?: string;
  score: [number, number];
  result: 'WIN' | 'LOSS' | 'DRAW';
  mode: 'rank' | 'friend' | 'word-chain' | 'word-guess' | 'room';
  points: number;
  finishedAt: Date;
};

export function arenaPeriodStart(period: ArenaRankingPeriod, now = new Date()) {
  /** 'all' không giới hạn thời gian nên không cần mốc bắt đầu. */
  if (period === 'all') return undefined;
  // Calendar periods in Asia/Ho_Chi_Minh (UTC+7), with weeks starting Monday.
  const local = new Date(now.getTime() + 7 * 3600000);
  local.setUTCHours(0, 0, 0, 0);
  if (period === 'month') local.setUTCDate(1);
  else local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return new Date(local.getTime() - 7 * 3600000);
}

@Injectable()
export class ArenaReadService {
  constructor(
    @InjectModel(ArenaMatchPlayer.name)
    private readonly players: Model<ArenaMatchPlayer>,
    @InjectModel(ArenaMatch.name) private readonly matches: Model<ArenaMatch>,
    @InjectModel(ArenaProfile.name)
    private readonly profiles: Model<ArenaProfile>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  /** Kiểm tra và chuyển user ID từ request sang ObjectId an toàn. */
  private userId(value: string) {
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
      throw new BadRequestException('Invalid user ID');
    return new Types.ObjectId(value);
  }

  /** Giới hạn kích thước kết quả để tránh truy vấn quá lớn. */
  private limit(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 50)
      throw new BadRequestException('Limit must be between 1 and 50');
    return value;
  }

  /** Tạo pipeline dùng chung để chỉ lấy các trận đã kết thúc. */
  private finishedMatches(rankOnly = false, since?: Date): PipelineStage[] {
    return [
      {
        $lookup: {
          from: this.matches.collection.name,
          localField: 'matchId',
          foreignField: '_id',
          as: 'match',
        },
      },
      { $unwind: '$match' },
      {
        $match: {
          'match.status': ArenaMatchStatus.FINISHED,
          ...(rankOnly ? { 'match.type': ArenaMatchType.RANK } : {}),
          ...(since ? { 'match.finishedAt': { $gte: since } } : {}),
        },
      },
    ];
  }

  /** Lấy lịch sử các trận gần đây cùng đối thủ và kết quả của người dùng. */
  async getRecentMatches(userId: string, limit = 20) {
    return this.players.aggregate<ArenaRecentMatch>([
      { $match: { userId: this.userId(userId) } },
      ...this.finishedMatches(),
      { $sort: { 'match.finishedAt': -1, matchId: -1 } },
      { $limit: this.limit(limit) },
      {
        $lookup: {
          from: this.players.collection.name,
          let: { matchId: '$matchId', userId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$matchId', '$$matchId'] },
                    { $ne: ['$userId', '$$userId'] },
                  ],
                },
              },
            },
            { $sort: { score: -1, userId: 1 } },
            { $limit: 1 },
            {
              $lookup: {
                from: this.users.collection.name,
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
              },
            },
            { $set: { user: { $arrayElemAt: ['$user', 0] } } },
          ],
          as: 'opponents',
        },
      },
      { $set: { opponent: { $arrayElemAt: ['$opponents', 0] } } },
      {
        $project: {
          _id: 0,
          id: { $toString: '$matchId' },
          name: {
            $cond: [
              { $eq: ['$opponent.user.isDeleted', true] },
              'Người chơi',
              { $ifNull: ['$opponent.user.username', 'Người chơi'] },
            ],
          },
          avatarUrl: {
            $cond: [
              { $eq: ['$opponent.user.isDeleted', true] },
              null,
              '$opponent.user.avatarUrl',
            ],
          },
          score: ['$score', { $ifNull: ['$opponent.score', 0] }],
          result: {
            $cond: [
              '$match.isDraw',
              'DRAW',
              {
                $cond: [{ $eq: ['$match.winnerId', '$userId'] }, 'WIN', 'LOSS'],
              },
            ],
          },
          mode: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$match.friendMode', 'WORD_GUESS'] },
                  then: 'word-guess',
                },
                {
                  case: { $eq: ['$match.type', ArenaMatchType.RANK] },
                  then: 'rank',
                },
                {
                  case: {
                    $and: [
                      { $eq: ['$match.type', ArenaMatchType.FRIEND] },
                      { $eq: ['$match.friendMode', 'WORD_CHAIN'] },
                    ],
                  },
                  then: 'word-chain',
                },
                {
                  case: { $eq: ['$match.type', ArenaMatchType.FRIEND] },
                  then: 'friend',
                },
              ],
              default: 'room',
            },
          },
          points: { $ifNull: ['$ratingChange', 0] },
          finishedAt: '$match.finishedAt',
        },
      },
    ]);
  }

  /** Xếp hạng người chơi theo rating trong tuần, tháng hoặc toàn thời gian. */
  async getLeaderboard(userId: string, period: string = 'week', limit = 5) {
    // Chỉ chấp nhận các khoảng thời gian mà giao diện Arena hỗ trợ.
    if (!['week', 'month', 'all'].includes(period))
      throw new BadRequestException('Invalid ranking period');
    const id = this.userId(userId).toString();
    const result = await this.players.aggregate<{
      players: ArenaRankingEntry[];
      me: ArenaRankingEntry[];
      total: { count: number }[];
    }>([
      // Starting from participants in FINISHED RANK matches excludes unused profiles and friend/room players.
      ...this.finishedMatches(
        true,
        arenaPeriodStart(period as ArenaRankingPeriod),
      ),
      {
        $group: {
          _id: '$userId',
          matches: { $sum: 1 },
          wins: {
            $sum: { $cond: [{ $eq: ['$match.winnerId', '$userId'] }, 1, 0] },
          },
          fallbackRating: {
            $max: { $ifNull: ['$ratingAfter', '$ratingBefore'] },
          },
        },
      },
      {
        $lookup: {
          from: this.profiles.collection.name,
          localField: '_id',
          foreignField: 'userId',
          as: 'profile',
        },
      },
      {
        $lookup: {
          from: this.users.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $match: { 'user.isDeleted': { $ne: true } } },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          name: { $ifNull: ['$user.username', 'Người chơi'] },
          avatarUrl: '$user.avatarUrl',
          matches: 1,
          wins: 1,
          rating: {
            $ifNull: [
              { $arrayElemAt: ['$profile.rating', 0] },
              '$fallbackRating',
            ],
          },
        },
      },
      {
        $setWindowFields: {
          sortBy: { rating: -1 },
          output: { position: { $rank: {} } },
        },
      },
      { $sort: { position: 1, wins: -1, userId: 1 } },
      {
        $facet: {
          players: [{ $limit: this.limit(limit) }],
          me: [{ $match: { userId: id } }, { $limit: 1 }],
          total: [{ $count: 'count' }],
        },
      },
    ]);
    return {
      period: period as ArenaRankingPeriod,
      players: result[0]?.players ?? [],
      me: result[0]?.me[0] ?? null,
      totalPlayers: result[0]?.total[0]?.count ?? 0,
    };
  }

  /** Tính số trận, thắng, thua, hòa và chuỗi thắng từ lịch sử ranked. */
  async getRankedStatistics(userId: string) {
    const result = await this.players.aggregate<{
      matches: number;
      wins: number;
      draws: number;
      outcomes: boolean[];
    }>([
      { $match: { userId: this.userId(userId) } },
      ...this.finishedMatches(true),
      { $sort: { 'match.finishedAt': 1, matchId: 1 } },
      {
        $group: {
          _id: null,
          matches: { $sum: 1 },
          wins: {
            $sum: { $cond: [{ $eq: ['$match.winnerId', '$userId'] }, 1, 0] },
          },
          draws: { $sum: { $cond: ['$match.isDraw', 1, 0] } },
          outcomes: { $push: { $eq: ['$match.winnerId', '$userId'] } },
        },
      },
    ]);
    const stats = result[0];
    let currentWinStreak = 0;
    let bestWinStreak = 0;
    for (const won of stats?.outcomes ?? []) {
      currentWinStreak = won ? currentWinStreak + 1 : 0;
      bestWinStreak = Math.max(bestWinStreak, currentWinStreak);
    }
    return {
      matches: stats?.matches ?? 0,
      wins: stats?.wins ?? 0,
      draws: stats?.draws ?? 0,
      losses: (stats?.matches ?? 0) - (stats?.wins ?? 0) - (stats?.draws ?? 0),
      winRate: stats?.matches
        ? Number(((stats.wins / stats.matches) * 100).toFixed(1))
        : 0,
      currentWinStreak,
      bestWinStreak,
    };
  }
}
