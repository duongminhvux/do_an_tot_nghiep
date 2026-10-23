import { PgId } from '../../postgres/compat.js';
import { ArenaSettingsService } from './admin/arena-settings.service.js';
import { ARENA_DEFAULTS } from './admin/arena-settings.defaults.js';
import { Injectable, Optional } from '@nestjs/common';
import { InjectPgModel } from '../../postgres/compat.js';
import { type Model } from '../../postgres/compat.js';
import { ArenaReadService } from './arena-read.service.js';
import {
  ArenaProfile,
  ArenaProfileDocument } from './schemas/arena-profile.schema.js';
import {
  ArenaRatingHistory,
  ArenaRatingHistoryDocument } from './schemas/arena-rating-history.schema.js';

export function arenaTodayRange(now = new Date()) {
  const local = new Date(now.getTime() + 7 * 3600000);
  local.setUTCHours(0, 0, 0, 0);
  const start = new Date(local.getTime() - 7 * 3600000);
  return { start, end: new Date(start.getTime() + 24 * 3600000) };
}

@Injectable()
export class ArenaService {
  constructor(
    private readonly arenaReadService: ArenaReadService,
    @InjectPgModel(ArenaProfile.name)
    private readonly arenaProfileModel: Model<ArenaProfileDocument>,
    @InjectPgModel(ArenaRatingHistory.name)
    private readonly ratingHistory: Model<ArenaRatingHistoryDocument>,
    @Optional() private readonly settings?: ArenaSettingsService,
  ) {}

  /** Elo hiện tại cùng tổng thay đổi trong ngày và thống kê ranked của chính người dùng. */
  async getMyArenaOverview(userId: string) {
    const profile = await this.getOrCreateProfile(userId);
    if (!profile) throw new Error('Arena profile could not be created');
    const { start, end } = arenaTodayRange();
    const [ranked, leaderboard, changes] = await Promise.all([
      this.arenaReadService.getRankedStatistics(userId),
      this.arenaReadService.getLeaderboard(userId, 'all', 1),
      this.ratingHistory.aggregate<{ total: number }>([
        {
          $match: {
            userId: new PgId(userId),
            createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$change' } } },
      ]),
    ]);
    return {
      userId: String(profile.userId),
      rating: profile.rating,
      todayRatingChange: changes[0]?.total ?? 0,
      leaderboard: {
        position: leaderboard.me?.position ?? null,
        topPercent:
          leaderboard.me && leaderboard.totalPlayers > 0
            ? Math.max(
                1,
                Math.ceil(
                  (leaderboard.me.position / leaderboard.totalPlayers) * 100,
                ),
              )
            : null,
        totalPlayers: leaderboard.totalPlayers },
      ranked };
  }

  /** Lấy profile có sẵn hoặc tạo profile Arena mặc định cho người dùng mới. */
  async getOrCreateProfile(userId: string) {
    const objectUserId = new PgId(userId);
    const config = this.settings
      ? await this.settings.current()
      : ARENA_DEFAULTS;

    return this.arenaProfileModel.findOneAndUpdate(
      {
        userId: objectUserId },
      {
        $setOnInsert: {
          userId: objectUserId,

          rating: config.ranked.defaultRating,

          rankedMatches: 0,
          rankedWins: 0,
          rankedLosses: 0,
          rankedDraws: 0,

          currentWinStreak: 0,
          bestWinStreak: 0 } },
      {
        returnDocument: 'after',
        upsert: true },
    );
  }

  /** Lấy profile Arena thô theo user ID cho các service nội bộ. */
  async getProfile(userId: string) {
    return this.arenaProfileModel.findOne({
      userId });
  }
}
