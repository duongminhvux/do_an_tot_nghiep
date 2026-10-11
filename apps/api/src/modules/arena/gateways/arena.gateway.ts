import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

import { AuthService } from '../../auth/auth.service.js';
import { ConnectionAuthenticated } from '../../auth/decorators/connection-authenticated.decorator.js';
import { ArenaMatchmakingService } from '../matchmaking/arena-matchmaking.service.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';
import { ArenaMatchService } from '../matches/arena-match.service.js';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ArenaRoundService } from '../question/arena-round.service.js';
import { ArenaMatchFinishReason } from '../schemas/arena-match.schema.js';

@ConnectionAuthenticated()
@WebSocketGateway({
  namespace: '/arena',
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class ArenaGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger = new Logger(ArenaGateway.name);
  private clock?: ReturnType<typeof setInterval>;
  private ticking = false;
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly matchmakingService: ArenaMatchmakingService,
    private readonly arenaMatchService: ArenaMatchService,
    private readonly presenceService: ArenaPresenceService,
    private readonly authService: AuthService,
    private readonly arenaRoundService: ArenaRoundService,
  ) {
    console.log('[ArenaGateway] initialized');
  }

  /** Khởi động clock server để xử lý timeout và chuyển vòng định kỳ. */
  onModuleInit() {
    this.clock = setInterval(() => {
      void this.tick();
    }, 500);
    this.clock.unref();
  }

  /** Dừng clock khi module bị hủy để tránh timer chạy ngoài vòng đời ứng dụng. */
  onModuleDestroy() {
    if (this.clock) clearInterval(this.clock);
  }

  /** Phát các event round đã được service tạo cho đúng match room. */
  private async tick() {
    if (this.ticking || !this.server) return;
    this.ticking = true;
    try {
      for (const matchId of await this.arenaMatchService.processLifecycle()) {
        const event = await this.arenaRoundService.finishedEvent(matchId);
        this.server.to(`match:${matchId}`).emit(event.event, event.data);
      }
      for (const batch of await this.arenaRoundService.tick()) {
        for (const item of batch.events)
          this.server.to(`match:${batch.matchId}`).emit(item.event, item.data);
      }
    } catch (error) {
      this.logger.error(
        'Arena clock failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.ticking = false;
    }
  }

  /** Xác thực socket bằng access token và đăng ký trạng thái presence. */
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      // Socket không có token không được phép truy cập các event Arena.
      if (typeof token !== 'string' || !token.trim()) {
        client.disconnect();
        return;
      }

      const payload = await this.authService.verifyToken(token);

      if (!client.connected) {
        return;
      }

      const userId = String(payload._id);

      client.data.userId = userId;

      await this.presenceService.connect(userId, client.id);
      client.emit('arena:authenticated');

      console.log('[Arena] Connected:', {
        userId,
        socketId: client.id,
      });
    } catch {
      client.disconnect();
    }
  }

  /** Xóa socket khỏi presence khi client ngắt kết nối. */
  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      return;
    }

    const result = await this.presenceService.disconnect(userId, client.id);

    if (!result.online) await this.arenaMatchService.markDisconnected(userId);

    console.log('[Arena] Disconnected:', result);
  }

  /** Ghép user vào queue, tạo match và thông báo cho cả hai người chơi. */
  @SubscribeMessage('ranked:join-queue')
  async joinQueue(@ConnectedSocket() client: Socket) {
    const userId = this.getUserId(client);

    console.log('[Arena] Join ranked queue:', {
      userId,
      socketId: client.id,
    });

    const result = await this.matchmakingService.joinQueue(userId);

    // Chưa tìm được đối thủ
    // Chưa ghép được thì chỉ trả trạng thái chờ, không tạo room trận.
    if (!result.matched) {
      return result;
    }

    const roomName = `match:${result.matchId}`;

    /*
     * result.players:
     *
     * [
     *   {
     *      userId: "...",
     *      rating: 1250
     *   },
     *   {
     *      userId: "...",
     *      rating: 1300
     *   }
     * ]
     */

    const [playerA, playerB] = result.players;

    const [playerASocketIds, playerBSocketIds] = await Promise.all([
      this.presenceService.getSocketIds(playerA.userId),

      this.presenceService.getSocketIds(playerB.userId),
    ]);

    const allSocketIds = [...playerASocketIds, ...playerBSocketIds];

    /*
     * Mỗi Socket.IO socket tự động join
     * một room có tên = socket.id.
     *
     * Vì vậy ta có thể lấy các socketId này
     * rồi cho tất cả join match room.
     *
     * Cách này cũng hoạt động tốt với
     * Redis Socket.IO Adapter.
     */
    if (allSocketIds.length > 0) {
      await this.server.in(allSocketIds).socketsJoin(roomName);
    }

    /*
     * Báo cho CẢ HAI người chơi:
     * match đã được tìm thấy.
     */
    if (playerASocketIds.length > 0) {
      this.server.to(playerASocketIds).emit('ranked:match-found', {
        matchId: result.matchId,
        opponent: playerB,
      });
    }
    if (playerBSocketIds.length > 0) {
      this.server.to(playerBSocketIds).emit('ranked:match-found', {
        matchId: result.matchId,
        opponent: playerA,
      });
    }

    console.log('[Arena] Ranked match found:', {
      matchId: result.matchId,
      roomName,
      players: result.players,
    });

    return {
      matched: true,
      matchId: result.matchId,
      opponent: playerA.userId === userId ? playerB : playerA,
    };
  }

  /** Rời hàng đợi matchmaking hiện tại. */
  @SubscribeMessage('ranked:leave-queue')
  async leaveQueue(@ConnectedSocket() client: Socket) {
    const userId = this.getUserId(client);

    console.log('[Arena] Leave ranked queue:', {
      userId,
      socketId: client.id,
    });

    return this.matchmakingService.leaveQueue(userId);
  }

  /** Xác nhận ready, join match room và phát snapshot hoặc bắt đầu trận. */
  @SubscribeMessage('match:ready')
  async handleMatchReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ) {
    const userId = this.getUserId(client);
    await this.arenaRoundService.assertMember(payload.matchId, userId);
    await client.join(`match:${payload.matchId}`);
    await this.arenaMatchService.markReconnected(payload.matchId, userId);
    const existing = await this.arenaRoundService.snapshot(payload.matchId);
    // Client reload giữa trận sẽ nhận lại event hiện tại thay vì ready lại.
    if (existing.length) {
      for (const item of existing) client.emit(item.event, item.data);
      return { success: true, status: 'PLAYING' };
    }
    const result = await this.arenaMatchService.markReady(
      payload.matchId,
      userId,
    );
    // Còn thiếu người chơi thì giữ match ở trạng thái chờ.
    if (!result.shouldStart) return { success: true, status: 'WAITING' };
    this.server
      .to(`match:${payload.matchId}`)
      .emit('match:start', { matchId: payload.matchId });
    for (const item of await this.arenaRoundService.snapshot(payload.matchId)) {
      this.server.to(`match:${payload.matchId}`).emit(item.event, item.data);
    }
    return { success: true, status: 'PLAYING' };
  }

  /** Nhận đáp án từ client, trả kết quả riêng và broadcast event cập nhật trận. */
  @SubscribeMessage('match:answer')
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      matchId: string;
      questionId: string;
      answer: string;
      attemptId?: string;
    },
  ) {
    const result = await this.arenaRoundService.submitAnswer({
      ...payload,
      userId: this.getUserId(client),
    });
    const answerResult = {
      ...result.answerResult,
      attemptId: payload.attemptId,
    };
    client.emit('match:answer-result', answerResult);
    for (const item of result.events)
      this.server.to(`match:${payload.matchId}`).emit(item.event, item.data);
    return { success: true, answerResult };
  }

  /** Xử lý người chơi chủ động rời trận như một lần forfeiting có tính Elo. */
  @SubscribeMessage('match:leave')
  async handleMatchLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ) {
    const userId = this.getUserId(client);
    await this.arenaRoundService.assertMember(payload.matchId, userId);
    const match = await this.arenaMatchService.findActiveMatchForUser(userId);
    if (!match || String(match._id) !== payload.matchId)
      throw new WsException('Match is not active');
    const opponentUserId = await this.arenaMatchService.getOpponentUserId(
      payload.matchId,
      userId,
    );
    if (!opponentUserId) throw new WsException('Opponent not found');

    const finished = await this.arenaMatchService.finishRankedMatch(
      payload.matchId,
      ArenaMatchFinishReason.PLAYER_LEFT,
      opponentUserId,
    );
    if (finished) {
      const event = await this.arenaRoundService.snapshot(payload.matchId);
      for (const item of event)
        this.server.to(`match:${payload.matchId}`).emit(item.event, item.data);
    }
    return { success: true };
  }

  /** Lấy user ID đã được gắn vào socket sau bước xác thực. */
  private getUserId(client: Socket): string {
    const userId = client.data.userId;

    // Không có user ID nghĩa là socket chưa được xác thực hợp lệ.
    if (typeof userId !== 'string' || !userId.trim()) {
      throw new WsException('Socket is not authenticated');
    }

    return userId;
  }
}
