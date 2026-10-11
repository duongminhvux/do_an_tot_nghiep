import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { RedisService } from '../../../common/redis/redis.service.js';

@Injectable()
export class ArenaMatchmakingService {
  private readonly queueKey = 'arena:matchmaking:queue';

  constructor(private readonly redisService: RedisService) {}

  async joinQueue(userId: string, payload: Record<string, unknown> = {}) {
    const redis = this.redisService.getClient();

    // Tạm hard-code để test.
    // Bước sau sẽ lấy từ ArenaProfile.
    const rating = Number(payload.rating ?? 1000);

    if (!Number.isFinite(rating)) {
      throw new WsException('Rating must be a finite number');
    }

    await redis.zAdd(this.queueKey, {
      score: rating,
      value: userId,
    });

    const opponent = await this.findOpponent(userId, rating);

    if (!opponent) {
      return {
        matched: false,
        status: 'WAITING',
        rating,
      };
    }

    await redis.zRem(this.queueKey, [userId, opponent.userId]);

    return {
      matched: true,
      opponent,
    };
  }

  async leaveQueue(userId: string) {
    const redis = this.redisService.getClient();

    const removed = await redis.zRem(this.queueKey, userId);

    return {
      success: removed > 0,
    };
  }

  private async findOpponent(userId: string, rating: number) {
    const redis = this.redisService.getClient();

    const minRating = rating - 100;
    const maxRating = rating + 100;

    const candidates = await redis.zRangeByScore(
      this.queueKey,
      minRating,
      maxRating,
    );

    const opponentId = candidates.find((candidateId) => candidateId !== userId);

    if (!opponentId) {
      return null;
    }

    const opponentRating = await redis.zScore(this.queueKey, opponentId);

    return {
      userId: opponentId,
      rating: opponentRating ?? 1000,
    };
  }
}
