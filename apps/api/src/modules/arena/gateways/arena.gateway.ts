import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
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
import {
  ArenaFriendMode,
  ArenaMatchType,
  ArenaMatchStatus,
} from '../schemas/arena-match.schema.js';
import {
  ArenaFriendlyService,
  FriendlyDelivery,
} from '../friendly/arena-friendly.service.js';

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
    OnGatewayInit,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger = new Logger(ArenaGateway.name);
  private clock?: ReturnType<typeof setInterval>;
  private ticking = false;
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly friendly: ArenaFriendlyService,
    private readonly matchmakingService: ArenaMatchmakingService,
    private readonly arenaMatchService: ArenaMatchService,
    private readonly presenceService: ArenaPresenceService,
    private readonly authService: AuthService,
    private readonly arenaRoundService: ArenaRoundService,
  ) {
    console.log('[ArenaGateway] initialized');
  }

  afterInit(server: Server) {
    this.presenceService.bindServer(server);
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
      for (const event of await this.friendly.tick())
        await this.deliverFriendly(event);
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
      for (const invite of await this.friendly.pending(userId)) {
        client.emit(
          invite.receiverId === userId
            ? 'friend:invite-received'
            : 'friend:invite-sent',
          invite,
        );
      }
      client.emit('arena:authenticated');

      console.log('[Arena] Connected:', {
        userId,
        socketId: client.id,
      });
    } catch {
      client.disconnect();
    }
  }

  /** Gia hạn presence để socket mất đột ngột không bị giữ trạng thái online. */
  @SubscribeMessage('arena:presence-heartbeat')
  async presenceHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (typeof userId !== 'string') return;

    await this.presenceService.touch(userId, client.id);
  }

  /** Xóa socket khỏi presence khi client ngắt kết nối. */
  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      return;
    }

    const result = await this.presenceService.disconnect(userId, client.id);

    const active = await this.arenaMatchService.findActiveMatchForUser(userId);
    if (
      active?.status === ArenaMatchStatus.PLAYING &&
      (client.data.activeMatchId === String(active._id) || !result.online)
    ) {
      await this.leaveMatch(userId, String(active._id));
    }

    if (!result.online) {
      await this.matchmakingService.leaveQueue(userId);
      await this.arenaMatchService.markDisconnected(userId);
      const match = await this.arenaMatchService.findActiveMatchForUser(userId);
      if (match?.type === ArenaMatchType.FRIEND) {
        this.server.to(`match:${String(match._id)}`).emit('friend:connection', {
          matchId: String(match._id),
          userId,
          disconnectedAt: new Date().toISOString(),
        });
      }
    }

    console.log('[Arena] Disconnected:', result);
  }

  /** Ghép user vào queue, tạo match và thông báo cho cả hai người chơi. */
  @SubscribeMessage('ranked:join-queue')
  async joinQueue(@ConnectedSocket() client: Socket) {
    try {
      return await this.joinRanked(client);
    } catch (error) {
      return {
        matched: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to join ranked queue',
      };
    }
  }

  private async joinRanked(client: Socket) {
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
    const active = await this.arenaMatchService.findActiveMatchForUser(userId);
    if (active?.type === ArenaMatchType.FRIEND)
      throw new WsException('Use the Friendly lobby to ready and start');
    await client.join(`match:${payload.matchId}`);
    client.data.activeMatchId = payload.matchId;
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
    return this.friendlyAction(() =>
      this.leaveMatch(this.getUserId(client), payload.matchId),
    );
  }

  async leaveMatch(userId: string, matchId: string) {
    await this.arenaRoundService.assertMember(matchId, userId);
    const match = await this.arenaMatchService.findActiveMatchForUser(userId);
    if (!match || String(match._id) !== matchId) return { success: true };
    if (match.type === ArenaMatchType.FRIEND) {
      for (const event of await this.friendly.leave(matchId, userId))
        this.server.to(`match:${matchId}`).emit(event.event, event.data);
      return { success: true };
    }
    if (match.status !== ArenaMatchStatus.PLAYING) return { success: true };
    const opponentUserId = await this.arenaMatchService.getOpponentUserId(
      matchId,
      userId,
    );
    if (!opponentUserId) throw new WsException('Opponent not found');

    const finished = await this.arenaMatchService.finishRankedMatch(
      matchId,
      ArenaMatchFinishReason.PLAYER_LEFT,
      opponentUserId,
    );
    if (finished) {
      const event = await this.arenaRoundService.snapshot(matchId);
      for (const item of event)
        this.server.to(`match:${matchId}`).emit(item.event, item.data);
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

  private async deliverFriendly(item: FriendlyDelivery) {
    if (item.users) {
      const ids = (
        await Promise.all(
          item.users.map((id) => this.presenceService.getSocketIds(id)),
        )
      ).flat();
      if (
        item.event === 'friend:match-created' &&
        typeof item.data.matchId === 'string'
      ) {
        await this.server.in(ids).socketsJoin(`match:${item.data.matchId}`);
      }
      this.server.to(ids).emit(item.event, item.data);
    } else if (item.matchId) {
      this.server.to(`match:${item.matchId}`).emit(item.event, item.data);
    }
  }

  private async friendlyAction(action: () => Promise<unknown>) {
    try {
      return { success: true, data: await action() };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Friendly action failed',
      };
    }
  }

  @SubscribeMessage('friend:invite')
  inviteFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { friendId: string; mode: ArenaFriendMode },
  ) {
    return this.friendlyAction(() =>
      this.inviteUser(this.getUserId(client), payload.friendId, payload.mode),
    );
  }

  async inviteUser(userId: string, friendId: string, mode: ArenaFriendMode) {
    const data = await this.friendly.invite(userId, friendId, mode);
    await this.deliverFriendly({
      users: [data.receiverId],
      event: 'friend:invite-received',
      data,
    });
    await this.deliverFriendly({
      users: [data.senderId],
      event: 'friend:invite-sent',
      data,
    });
    return data;
  }

  @SubscribeMessage('friend:invite-accept')
  acceptFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { inviteId: string },
  ) {
    return this.friendlyAction(async () => {
      const event = await this.friendly.respond(
        this.getUserId(client),
        payload.inviteId,
        true,
      );
      await this.deliverFriendly(event);
      return event.data;
    });
  }

  @SubscribeMessage('friend:invite-decline')
  declineFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { inviteId: string },
  ) {
    return this.friendlyAction(async () => {
      const event = await this.friendly.respond(
        this.getUserId(client),
        payload.inviteId,
        false,
      );
      await this.deliverFriendly(event);
      return event.data;
    });
  }

  @SubscribeMessage('friend:invite-cancel')
  cancelFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { inviteId: string },
  ) {
    return this.friendlyAction(async () => {
      await this.deliverFriendly(
        await this.friendly.cancel(this.getUserId(client), payload.inviteId),
      );
    });
  }

  @SubscribeMessage('friend:join')
  joinFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ) {
    return this.friendlyAction(async () => {
      const userId = this.getUserId(client);
      await this.friendly.member(payload.matchId, userId);
      await this.arenaMatchService.markReconnected(payload.matchId, userId);
      await client.join(`match:${payload.matchId}`);
      client.data.activeMatchId = payload.matchId;
      this.server.to(`match:${payload.matchId}`).emit('friend:connection', {
        matchId: payload.matchId,
        userId,
        disconnectedAt: null,
      });
      const data = await this.friendly.snapshot(payload.matchId, userId);
      client.emit('friend:snapshot', data);
      for (const event of await this.friendly.gameSnapshot(payload.matchId))
        this.server
          .to(`match:${payload.matchId}`)
          .emit(event.event, event.data);
      return data;
    });
  }

  @SubscribeMessage('friend:ready')
  readyFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ) {
    return this.friendlyAction(async () => {
      const userId = this.getUserId(client);
      await this.friendly.ready(payload.matchId, userId);
      this.server.to(`match:${payload.matchId}`).emit('friend:ready-update', {
        matchId: payload.matchId,
        userId,
        isReady: true,
      });
    });
  }

  @SubscribeMessage('friend:mode')
  modeFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; mode: ArenaFriendMode },
  ) {
    return this.friendlyAction(async () => {
      const userId = this.getUserId(client);
      await this.friendly.setMode(payload.matchId, userId, payload.mode);
      this.server
        .to(`match:${payload.matchId}`)
        .emit(
          'friend:snapshot',
          await this.friendly.snapshot(payload.matchId, userId),
        );
    });
  }

  @SubscribeMessage('friend:start')
  startFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ) {
    return this.friendlyAction(async () => {
      for (const event of await this.friendly.start(
        payload.matchId,
        this.getUserId(client),
      ))
        await this.deliverFriendly({ matchId: payload.matchId, ...event });
    });
  }

  @SubscribeMessage('word-chain:submit')
  submitWord(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; word: string },
  ) {
    return this.friendlyAction(async () => {
      for (const event of await this.friendly.submit(
        payload.matchId,
        this.getUserId(client),
        payload.word,
      )) {
        if (event.event === 'word-chain:invalid')
          client.emit(event.event, event.data);
        else await this.deliverFriendly({ matchId: payload.matchId, ...event });
      }
    });
  }

  @SubscribeMessage('friend:leave')
  leaveFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ) {
    return this.friendlyAction(async () => {
      for (const event of await this.friendly.leave(
        payload.matchId,
        this.getUserId(client),
      ))
        await this.deliverFriendly({ matchId: payload.matchId, ...event });
      await client.leave(`match:${payload.matchId}`);
    });
  }

  @SubscribeMessage('friend:rematch-request')
  rematchFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ) {
    return this.friendlyAction(async () => {
      const data = await this.friendly.rematch(
        payload.matchId,
        this.getUserId(client),
      );
      await this.deliverFriendly({
        users: [data.receiverId],
        event: 'friend:invite-received',
        data,
      });
      await this.deliverFriendly({
        users: [data.senderId],
        event: 'friend:invite-sent',
        data,
      });
      return data;
    });
  }

  @SubscribeMessage('friend:rematch-accept')
  acceptRematch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { inviteId: string },
  ) {
    return this.acceptFriend(client, payload);
  }

  @SubscribeMessage('friend:rematch-decline')
  declineRematch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { inviteId: string },
  ) {
    return this.declineFriend(client, payload);
  }
}
