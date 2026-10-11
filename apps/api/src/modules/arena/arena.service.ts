import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ArenaReadService } from './arena-read.service.js';
import {
  ArenaProfile,
  ArenaProfileDocument,
} from './schemas/arena-profile.schema.js';
import {
  ArenaRatingHistory,
  ArenaRatingHistoryDocument,
} from './schemas/arena-rating-history.schema.js';

@Injectable()
export class ArenaService {
  constructor(
    private readonly arenaReadService: ArenaReadService,
    @InjectModel(ArenaProfile.name)
    private readonly arenaProfileModel: Model<ArenaProfileDocument>,

    @InjectModel(ArenaRatingHistory.name)
    private readonly arenaRatingHistoryModel: Model<ArenaRatingHistoryDocument>,
  ) {}

  /** Tổng hợp profile, thứ hạng và thống kê ranked của người dùng hiện tại. */
  async getMyArenaOverview(userId: string) {
    const profile = await this.getOrCreateProfile(userId);
    const [rankings, ranked, todayRatingChange] = await Promise.all([
      this.arenaReadService.getLeaderboard(userId, 'all', 1),
      this.arenaReadService.getRankedStatistics(userId),
      this.getTodayRatingChange(new Types.ObjectId(userId)),
    ]);
    return {
      userId: profile.userId.toString(),
      rating: profile.rating,
      leaderboard: {
        position: rankings.me?.position ?? null,
        topPercent:
          rankings.me && rankings.totalPlayers > 0
            ? Math.max(
                1,
                Math.ceil((rankings.me.position / rankings.totalPlayers) * 100),
              )
            : null,
        totalPlayers: rankings.totalPlayers,
      },
      todayRatingChange,
      ranked,
    };
  }

  /** Lấy profile có sẵn hoặc tạo profile Arena mặc định cho người dùng mới. */
  async getOrCreateProfile(userId: string) {
    const objectUserId = new Types.ObjectId(userId);

    return this.arenaProfileModel.findOneAndUpdate(
      {
        userId: objectUserId,
      },
      {
        $setOnInsert: {
          userId: objectUserId,

          rating: 1000,

          rankedMatches: 0,
          rankedWins: 0,
          rankedLosses: 0,
          rankedDraws: 0,

          currentWinStreak: 0,
          bestWinStreak: 0,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );
  }

  /** Lấy profile Arena thô theo user ID cho các service nội bộ. */
  async getProfile(userId: string) {
    return this.arenaProfileModel.findOne({
      userId,
    });
  }

  /** Cộng toàn bộ thay đổi rating được ghi nhận từ đầu ngày đến hiện tại. */
  private async getTodayRatingChange(userId: Types.ObjectId): Promise<number> {
    const startOfToday = new Date();

    startOfToday.setHours(0, 0, 0, 0);

    const result = await this.arenaRatingHistoryModel.aggregate<{
      total: number;
    }>([
      {
        $match: {
          userId,
          createdAt: {
            $gte: startOfToday,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: '$change',
          },
        },
      },
    ]);

    return result[0]?.total ?? 0;
  }
}
