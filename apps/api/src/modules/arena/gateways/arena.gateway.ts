import { Socket } from 'socket.io';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';

import { AuthService } from '../../auth/auth.service.js';
import { ConnectionAuthenticated } from '../../auth/decorators/connection-authenticated.decorator.js';
import { ArenaMatchmakingService } from '../matchmaking/arena-matchmaking.service.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';

@ConnectionAuthenticated()
@WebSocketGateway({
  namespace: '/arena',
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class ArenaGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly matchmakingService: ArenaMatchmakingService,
    private readonly presenceService: ArenaPresenceService,
    private readonly authService: AuthService,
  ) {
    console.log('[ArenaGateway] initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      if (typeof token !== 'string' || !token.trim()) {
        client.disconnect();
        return;
      }

      const payload = await this.authService.verifyToken(token);
      if (!client.connected) return;
      const userId = String(payload._id);

      client.data.userId = userId;

      await this.presenceService.connect(userId, client.id);

      console.log('[Arena] Connected:', {
        userId,
        socketId: client.id,
      });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      return;
    }

    const result = await this.presenceService.disconnect(userId, client.id);

    console.log('[Arena] Disconnected:', result);
  }

  @SubscribeMessage('ranked:join-queue')
  joinQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Record<string, unknown> = {},
  ) {
    const userId = this.getUserId(client);

    console.log('[Arena] Join ranked queue:', {
      userId,
      socketId: client.id,
      payload,
    });

    return this.matchmakingService.joinQueue(userId, payload);
  }

  @SubscribeMessage('arena:leave-queue')
  leaveQueue(@ConnectedSocket() client: Socket) {
    const userId = this.getUserId(client);

    console.log('[Arena] Leave queue:', {
      userId,
      socketId: client.id,
    });

    return this.matchmakingService.leaveQueue(userId);
  }

  private getUserId(client: Socket): string {
    const userId = client.data.userId;
    if (typeof userId !== 'string' || !userId.trim()) {
      throw new WsException('Socket is not authenticated');
    }
    return userId;
  }
}
