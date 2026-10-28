import { Injectable,Optional } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { rowData,rows,sql } from '../../../postgres/sql.js';
import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { ArenaSettingsService } from '../admin/arena-settings.service.js';

import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { RedisService } from '../../../common/redis/redis.service.js';
import { ArenaService } from '../arena.service.js';
import { ArenaMatchService } from '../matches/arena-match.service.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';

export type RankedPlayer = {
  userId: string;
  rating: number;
  username?: string;
  avatar?: string;
};

export type ArenaQueueResult =
  | { matched: false; status: 'WAITING'; rating: number }
  | {
      matched: true;
      matchId: string;
      players: [RankedPlayer, RankedPlayer];
    };

@Injectable()
export class ArenaMatchmakingService {
  private readonly queueKey = 'arena:matchmaking:queue';

  constructor(
    private readonly presence: ArenaPresenceService,
    private readonly redisService: RedisService,
    private readonly arenaProfileService: ArenaService,
    private readonly arenaMatchService: ArenaMatchService,
    @InjectPgConnection() private readonly db:PgConnection,
    @Optional() private readonly settings?: ArenaSettingsService,
  ) {}

  /** Thêm người chơi vào queue và ghép với đối thủ có rating tương đương. */
  async joinQueue(userId: string): Promise<ArenaQueueResult> {
    if (this.settings) await this.settings.requireEnabled('RANK');
    const redis = this.redisService.getClient();
    const lockKey = `${this.queueKey}:lock`;
    const token = randomUUID();
    let locked = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await redis.set(lockKey, token, { NX: true, PX: 30000 })) {
        locked = true;
        break;
      }
      await delay(50);
    }
    if (!locked) throw new WsException('Matchmaking is busy; please try again');
    try {
      return await this.joinLocked(userId);
    } finally {
      await redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        { keys: [lockKey], arguments: [token] },
      );
    }
  }

  private async joinLocked(userId: string): Promise<ArenaQueueResult> {
    const redis = this.redisService.getClient();
    if (!(await this.presence.isOnline(userId)))
      throw new WsException('Socket is not connected');

    const activeMatch =
      await this.arenaMatchService.findActiveMatchForUser(userId);
    if (activeMatch) {
      throw new WsException('You already have an active Arena match');
    }

    const profile = await this.arenaProfileService.getOrCreateProfile(userId);

    // Profile phải tồn tại để matchmaking có rating làm tiêu chí ghép cặp.
    if (!profile) {
      throw new WsException('Arena profile not found');
    }

    const rating = profile.rating;

    // Rating không hợp lệ khiến việc so sánh khoảng điểm không đáng tin cậy.
    if (!Number.isFinite(rating)) {
      throw new WsException('Invalid arena rating');
    }

    await redis.zAdd(this.queueKey, {
      score: rating,
      value: userId });

    const opponent = await this.findOpponent(userId, rating);

    // Chưa có đối thủ phù hợp thì giữ người chơi trong queue để chờ lượt sau.
    if (!opponent) {
      return {
        matched: false,
        status: 'WAITING',
        rating };
    }

    const users=(await rows(this.db,sql`SELECT id,username,avatar_url,is_deleted,is_banned FROM public.identity_profiles
      WHERE id=ANY(${[userId,opponent.userId]}::uuid[]) AND is_deleted IS NOT TRUE AND is_banned IS NOT TRUE`)).map(row=>rowData<any>(row));
    const userById = new Map(users.map((user) => [String(user._id), user]));
    const playerA = userById.get(userId);
    const playerB = userById.get(opponent.userId);

    // Không tạo trận nếu thiếu dữ liệu tài khoản của một trong hai người.
    if (!playerA || !playerB) {
      await redis.zRem(this.queueKey, opponent.userId);
      throw new WsException('Arena player not found');
    }

    const claimed = await redis.eval(
      "if redis.call('zscore', KEYS[1], ARGV[1]) and redis.call('zscore', KEYS[1], ARGV[2]) then redis.call('zrem', KEYS[1], ARGV[1], ARGV[2]); return 1 else return 0 end",
      { keys: [this.queueKey], arguments: [userId, opponent.userId] },
    );
    if (!claimed) return { matched: false, status: 'WAITING', rating };

    const { match } = await this.arenaMatchService.createRankedMatch(
      userId,
      opponent.userId,
    );

    return {
      matched: true,
      matchId: String(match._id),
      players: [
        {
          userId,
          rating: profile.rating,
          username: playerA.username,
          avatar: playerA.avatarUrl },
        {
          userId: opponent.userId,
          rating: opponent.rating,
          username: playerB.username,
          avatar: playerB.avatarUrl },
      ] };
  }

  /** Xóa người chơi khỏi queue khi họ hủy tìm trận. */
  async leaveQueue(userId: string) {
    const redis = this.redisService.getClient();

    const removed = await redis.zRem(this.queueKey, userId);

    return {
      success: removed > 0 };
  }

  /** Tìm một người chơi khác trong khoảng rating cho phép. */
  private async findOpponent(userId: string, rating: number) {
    const redis = this.redisService.getClient();

    const config = this.settings
      ? await this.settings.current()
      : ARENA_DEFAULTS;
    const minRating = rating - config.ranked.ratingRange;
    const maxRating = rating + config.ranked.ratingRange;

    const candidates = await redis.zRangeByScore(
      this.queueKey,
      minRating,
      maxRating,
    );

    for (const opponentId of candidates) {
      if (opponentId === userId) continue;
      if (
        !(await this.presence.isOnline(opponentId)) ||
        (await this.arenaMatchService.findActiveMatchForUser(opponentId))
      ) {
        await redis.zRem(this.queueKey, opponentId);
        continue;
      }
      const opponentRating = await redis.zScore(this.queueKey, opponentId);
      if (opponentRating !== null)
        return { userId: opponentId, rating: opponentRating };
    }
    return null;
  }
}
