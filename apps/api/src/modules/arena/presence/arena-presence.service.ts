import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../common/redis/redis.service.js';

@Injectable()
export class ArenaPresenceService {
  constructor(private readonly redisService: RedisService) {}

  /** Lưu socket đang hoạt động của user để gửi event tới mọi thiết bị của họ. */
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

  /** Xóa socket đã ngắt và chỉ đánh dấu offline khi user không còn socket nào. */
  async disconnect(userId: string, socketId: string) {
    const redis = this.redisService.getClient();
    const userSocketsKey = `arena:user:sockets:${userId}`;
    const socketUserKey = `arena:socket:user:${socketId}`;

    await Promise.all([
      redis.sRem(userSocketsKey, socketId),
      redis.del(socketUserKey),
    ]);

    const remainingSockets = await redis.sCard(userSocketsKey);

    // Xóa set rỗng để Redis không lưu key không còn giá trị.
    if (remainingSockets === 0) {
      await redis.del(userSocketsKey);
    }

    return {
      userId,
      socketId,
      online: remainingSockets > 0,
    };
  }

  /** Kiểm tra user có ít nhất một kết nối Arena đang hoạt động hay không. */
  async isOnline(userId: string) {
    const redis = this.redisService.getClient();
    const count = await redis.sCard(`arena:user:sockets:${userId}`);

    return count > 0;
  }

  /** Lấy toàn bộ socket ID của user để broadcast event. */
  async getSocketIds(userId: string) {
    const redis = this.redisService.getClient();

    return redis.sMembers(`arena:user:sockets:${userId}`);
  }
}
