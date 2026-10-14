import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class ArenaPresenceService {
  private server?: Pick<Server, 'fetchSockets'>;

  bindServer(server: Pick<Server, 'fetchSockets'>) {
    this.server = server;
  }

  // fetchSockets also covers other nodes when the Socket.IO Redis adapter is enabled.
  // Redis sets left behind by an API restart are never treated as live connections.
  private async sockets() {
    const sockets = (await this.server?.fetchSockets()) ?? [];
    return sockets.filter(
      (socket) => typeof socket.data.userId === 'string' && socket.data.userId,
    );
  }

  async connect(userId: string, socketId: string) {
    return { userId, socketId, online: await this.isOnline(userId) };
  }

  async touch(userId: string, socketId: string) {
    return (await this.getSocketIds(userId)).includes(socketId);
  }

  async disconnect(userId: string, socketId: string) {
    const remaining = (await this.getSocketIds(userId)).filter(
      (id) => id !== socketId,
    );
    return { userId, socketId, online: remaining.length > 0 };
  }

  async isOnline(userId: string) {
    return (await this.getSocketIds(userId)).length > 0;
  }

  async getSocketIds(userId: string) {
    return (await this.sockets())
      .filter((socket) => socket.data.userId === userId)
      .map((socket) => socket.id);
  }

  async overview() {
    const users = new Set(
      (await this.sockets()).map((socket) => socket.data.userId as string),
    );
    return { onlineCount: users.size };
  }
}
