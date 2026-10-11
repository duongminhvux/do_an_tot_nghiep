import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../common/redis/redis.service.js';

@Injectable()
export class ArenaPresenceService {
  constructor(private readonly redisService: RedisService) {}

  async connect(userId: string, socketId: string) {
    const redis = this.redisService.getClient();
    const userSocketsKey = `arena:user:sockets:${userId}`;
    const socketUserKey = `arena:socket:user:${socketId}`;

    await Promise.all([
      redis.sAdd(userSocketsKey, socketId),
      redis.set(socketUserKey, userId),
    ]);

    return {
      userId,
      socketId,
      online: true,
    };
  }

  async disconnect(userId: string, socketId: string) {
    const redis = this.redisService.getClient();
    const userSocketsKey = `arena:user:sockets:${userId}`;
    const socketUserKey = `arena:socket:user:${socketId}`;

    await Promise.all([
      redis.sRem(userSocketsKey, socketId),
      redis.del(socketUserKey),
    ]);

    const remainingSockets = await redis.sCard(userSocketsKey);

    if (remainingSockets === 0) {
      await redis.del(userSocketsKey);
    }

    return {
      userId,
      socketId,
      online: remainingSockets > 0,
    };
  }

  async isOnline(userId: string) {
    const redis = this.redisService.getClient();
    const count = await redis.sCard(`arena:user:sockets:${userId}`);

    return count > 0;
  }

  async getSocketIds(userId: string) {
    const redis = this.redisService.getClient();

    return redis.sMembers(`arena:user:sockets:${userId}`);
  }
}