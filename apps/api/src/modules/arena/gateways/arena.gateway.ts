import { ArenaFriendRoomService } from '../friendly/arena-friend-room.service.js';
import { FriendRoomSettings } from '../schemas/friend-room.schema.js';
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

import { IdentityTokenVerifier } from '../../auth/service-jwt.module.js';
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
    private readonly identityVerifier: IdentityTokenVerifier,
    private readonly arenaRoundService: ArenaRoundService,
    private readonly friendRooms: ArenaFriendRoomService,
  ) {
    console.log('[ArenaGateway] initialized');
  }

  afterInit(server: Server) {
    this.presenceService.bindServer(server);
  }

  /** Khởi động clock server để xử lý timeout và chuyển vòng định kỳ. */
  onModuleInit() {
    // In gateway migration mode the legacy API provides fallback HTTP only.
    // Only arena-service may advance match clocks.
    if (process.env.SERVICE_ROLE === 'legacy') return;
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
      for (const event of await this.friendRooms.tick())
        await this.deliverFriendly(event);
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
    if (process.env.SERVICE_ROLE === 'legacy') { client.disconnect(true); return; }
    try {
      const token = client.handshake.auth?.token;

      // Socket không có token không được phép truy cập các event Arena.
      if (typeof token !== 'string' || !token.trim()) {
        client.disconnect();
        return;
      }

      const payload = await this.identityVerifier.verifyToken(token);
      if (payload.role !== 'USER') { client.disconnect(); return; }

      if (!client.connected) {
        return;
      }

      const userId = String(payload._id);

      client.data.userId = userId;

      if (!(await this.presenceService.isOnline(userId))) {
        const expired = await this.friendRooms.expireBeforeReconnect(userId);
        if (expired) await this.deliverFriendly(expired);
      }
      await this.presenceService.connect(userId, client.id);
      for (const invite of await this.friendly.pending(userId)) {
        client.emit(
          invite.receiverId === userId
            ? 'friend:invite-received'
            : 'friend:invite-sent',
          invite,
        );
      }
      const room = await this.friendRooms.connection(userId, true);
      if (room) {
        await client.join(`friend-room:${room.roomId}`);
        client.emit('friend-room:update', room);
      }
      // Only authenticated sockets can observe player presence.
      if (!client.connected) return;
      await client.join('arena:presence');
      if (!client.connected) return;
      client.emit('arena:authenticated');
      this.server.to('arena:presence').emit('arena:presence-changed', {
        userId,
        online: true,
      });

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
    if (!result.online) {
      this.server.to('arena:presence').emit('arena:presence-changed', {
        userId,
        online: false,
      });
    }

    const active = await this.arenaMatchService.findActiveMatchForUser(userId);
    if (
      active?.type === ArenaMatchType.RANK &&
      active.status === ArenaMatchStatus.PLAYING &&
      (client.data.activeMatchId === String(active._id) || !result.online)
    )
      await this.leaveMatch(userId, String(active._id));

    if (!result.online) {
      await this.friendRooms.connection(userId, false);
      await this.matchmakingService.leaveQueue(userId);
      await this.arenaMatchService.markDisconnected(userId);
      const match = await this.arenaMatchService.findActiveMatchForUser(userId);
      if (
        match?.type === ArenaMatchType.FRIEND ||
        match?.type === ArenaMatchType.ROOM
      ) {
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

    if (await this.friendRooms.active(userId))
      throw new WsException('ALREADY_IN_ROOM');
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
    if (
      active?.type === ArenaMatchType.FRIEND ||
      active?.type === ArenaMatchType.ROOM
    )
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
    const completedRoomMatch =
      !match || String(match._id) !== matchId
        ? await this.friendly.member(matchId, userId).catch(() => null)
        : null;
    const roomId =
      String(match?._id) === matchId &&
      (match?.type === ArenaMatchType.FRIEND ||
        match?.type === ArenaMatchType.ROOM)
        ? match.roomId
        : completedRoomMatch?.roomId;
    if (roomId) {
      if (await this.friendRooms.active(userId))
        await this.leaveRoom(String(roomId), userId);
      return { success: true };
    }
    if (!match || String(match._id) !== matchId) {
      for (const event of await this.friendly.leaveResult(matchId, userId))
        await this.deliverFriendly({ matchId, ...event });
      return { success: true };
    }
    if (
      match.type === ArenaMatchType.FRIEND ||
      match.type === ArenaMatchType.ROOM
    ) {
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

  async deliverAdminEvent(item: FriendlyDelivery) {
    if (!this.server) return;
    return this.deliverFriendly(item);
  }
  private async deliverFriendly(item: FriendlyDelivery) {
    if (item.users) {
      const ids = (
        await Promise.all(
          item.users.map((id) => this.presenceService.getSocketIds(id)),
        )
      ).flat();
      if (
        ['friend:match-created', 'friend-room:started'].includes(item.event) &&
        typeof item.data.matchId === 'string'
      ) {
        await this.server.in(ids).socketsJoin(`match:${item.data.matchId}`);
      }
      if (
        (item.event === 'friend-room:closed' ||
          (item.event === 'friend:invite-accepted' &&
            Array.isArray(item.data.players) &&
            item.data.players.length >= Number(item.data.maxPlayers ?? 2))) &&
        typeof item.data.roomId === 'string'
      )
        for (const event of await this.friendly.cancelRoomInvites(
          item.data.roomId,
        ))
          await this.deliverFriendly(event);
      if (
        item.event === 'friend:invite-accepted' &&
        typeof item.data.roomId === 'string'
      ) {
        await this.server
          .in(ids)
          .socketsJoin(`friend-room:${item.data.roomId}`);
        this.server
          .to(`friend-room:${item.data.roomId}`)
          .emit('friend-room:update', item.data);
      }
      this.server.to(ids).emit(item.event, item.data);
      if (
        item.event === 'friend-room:closed' &&
        typeof item.data.roomId === 'string'
      ) {
        await this.server
          .in(`friend-room:${item.data.roomId}`)
          .socketsLeave(`friend-room:${item.data.roomId}`);
      }
    } else if (item.matchId) {
      const matchId =
        typeof item.data.matchId === 'string'
          ? item.data.matchId
          : item.matchId;
      this.server.to(`match:${matchId}`).emit(item.event, item.data);
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

  @SubscribeMessage('friend-room:create')
  createFriendRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      mode?: ArenaFriendMode;
      settings?: FriendRoomSettings;
      maxPlayers?: number;
    },
  ) {
    return this.friendlyAction(async () => {
      const userId = this.getUserId(client);
      await this.matchmakingService.leaveQueue(userId);
      const data = await this.friendRooms.create(
        userId,
        payload.mode,
        payload.settings,
        payload.maxPlayers,
      );
      await client.join(`friend-room:${data.roomId}`);
      client.emit('friend-room:created', data);
      return data;
    });
  }
  @SubscribeMessage('friend-room:join')
  joinFriendRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { code?: string; roomId?: string; roomType?: 'FRIEND' | 'ROOM' },
  ) {
    return this.friendlyAction(async () => {
      const userId = this.getUserId(client);
      if (
        (payload.roomType !== undefined &&
          payload.roomType !== 'FRIEND' &&
          payload.roomType !== 'ROOM') ||
        (!payload.roomId && !payload.roomType)
      )
        throw new WsException('INVALID_ROOM_TYPE');
      const existing = await this.friendRooms.active(userId);
      if (
        existing &&
        payload.roomType &&
        (existing.maxPlayers > 2 ? 'ROOM' : 'FRIEND') !== payload.roomType &&
        existing.code === payload.code?.trim().toUpperCase()
      )
        throw new WsException('ROOM_TYPE_MISMATCH');
      const data = payload.roomId
        ? await this.friendRooms.snapshot(payload.roomId, userId)
        : existing && existing.code === payload.code?.trim().toUpperCase()
          ? await this.friendRooms.snapshot(String(existing._id), userId)
          : await this.friendRooms.join(
              userId,
              payload.code!,
              payload.roomType,
            );
      if (
        payload.roomType &&
        (data.maxPlayers > 2 ? 'ROOM' : 'FRIEND') !== payload.roomType
      )
        throw new WsException('ROOM_TYPE_MISMATCH');
      await this.matchmakingService.leaveQueue(userId);
      await client.join(`friend-room:${data.roomId}`);
      if (data.players.length >= data.maxPlayers)
        for (const event of await this.friendly.cancelRoomInvites(data.roomId))
          await this.deliverFriendly(event);
      this.server
        .to(`friend-room:${data.roomId}`)
        .emit('friend-room:update', data);
      return data;
    });
  }
  @SubscribeMessage('friend-room:current')
  currentFriendRoom(@ConnectedSocket() client: Socket) {
    return this.friendlyAction(async () => {
      const userId = this.getUserId(client);
      const room = await this.friendRooms.active(userId);
      return room ? this.friendRooms.snapshot(String(room._id), userId) : null;
    });
  }
  @SubscribeMessage('friend-room:settings-update')
  updateFriendRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string;
      mode: ArenaFriendMode;
      settings: FriendRoomSettings;
      maxPlayers?: number;
    },
  ) {
    return this.friendlyAction(async () => {
      const data = await this.friendRooms.update(
        payload.roomId,
        this.getUserId(client),
        payload.mode,
        payload.settings,
        payload.maxPlayers,
      );
      if (data.players.length >= data.maxPlayers)
        for (const event of await this.friendly.cancelRoomInvites(data.roomId))
          await this.deliverFriendly(event);
      this.server
        .to(`friend-room:${payload.roomId}`)
        .emit('friend-room:update', data);
      return data;
    });
  }
  @SubscribeMessage('friend-room:ready')
  readyFriendRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; ready: boolean },
  ) {
    return this.friendlyAction(async () => {
      const data = await this.friendRooms.ready(
        payload.roomId,
        this.getUserId(client),
        payload.ready,
      );
      this.server
        .to(`friend-room:${payload.roomId}`)
        .emit('friend-room:update', data);
      return data;
    });
  }
  @SubscribeMessage('friend-room:start')
  startFriendRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    return this.friendlyAction(async () => {
      const started = await this.friendRooms.start(
        payload.roomId,
        this.getUserId(client),
      );
      await this.deliverFriendly({
        users: started.users,
        event: 'friend-room:started',
        data: started,
      });
      return started;
    });
  }
  private async leaveRoom(roomId: string, userId: string) {
    const room = await this.friendRooms.member(roomId, userId);
    const event = await this.friendRooms.leave(roomId, userId);
    if (room.currentMatchId && room.maxPlayers > 2)
      await this.deliverFriendly({
        matchId: String(room.currentMatchId),
        event: 'friend:snapshot',
        data: await this.friendly.snapshot(String(room.currentMatchId), userId),
      });
    if (room.currentMatchId)
      for (const update of await this.friendly.gameSnapshot(
        String(room.currentMatchId),
      ))
        await this.deliverFriendly({
          matchId: String(room.currentMatchId),
          ...update,
        });
    await this.deliverFriendly(event);
    const departingSockets = await this.presenceService.getSocketIds(userId);
    if (departingSockets.length)
      await this.server
        .in(departingSockets)
        .socketsLeave(`friend-room:${roomId}`);
  }

  @SubscribeMessage('friend-room:leave')
  leaveFriendRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    return this.friendlyAction(async () => {
      await this.leaveRoom(payload.roomId, this.getUserId(client));
      await client.leave(`friend-room:${payload.roomId}`);
    });
  }

  @SubscribeMessage('friend:invite-pending')
  pendingFriendInvites(@ConnectedSocket() client: Socket) {
    return this.friendlyAction(() =>
      this.friendly.pending(this.getUserId(client)),
    );
  }

  @SubscribeMessage('friend:invite')
  inviteFriend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { friendId: string; mode: ArenaFriendMode; roomId?: string },
  ) {
    return this.friendlyAction(() =>
      this.inviteUser(
        this.getUserId(client),
        payload.friendId,
        payload.mode,
        payload.roomId,
      ),
    );
  }

  async inviteUser(
    userId: string,
    friendId: string,
    mode: ArenaFriendMode,
    roomId?: string,
  ) {
    const data = await this.friendly.invite(
      userId,
      friendId,
      mode,
      undefined,
      roomId,
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
      if (event.event === 'friend:invite-accepted')
        await this.matchmakingService.leaveQueue(this.getUserId(client));
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
    @MessageBody() payload: { matchId: string; returnToLobby?: boolean },
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
      const data = payload.returnToLobby
        ? await this.friendly.returnToLobby(payload.matchId, userId)
        : await this.friendly.snapshot(payload.matchId, userId);
      if (payload.returnToLobby)
        this.server
          .to('match:' + payload.matchId)
          .emit('friend:snapshot', data);
      else client.emit('friend:snapshot', data);
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

  @SubscribeMessage('word-guess:state')
  wordGuessState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ) {
    return this.friendlyAction(() =>
      this.friendly.wordGuessSnapshot(payload.matchId, this.getUserId(client)),
    );
  }

  @SubscribeMessage('word-guess:submit')
  submitWordGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; word: string },
  ) {
    return this.friendlyAction(async () => {
      const result = await this.friendly.submitWordGuess(
        payload.matchId,
        this.getUserId(client),
        payload.word,
      );
      for (const event of await this.friendly.gameSnapshot(payload.matchId))
        await this.deliverFriendly({ matchId: payload.matchId, ...event });
      return result;
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
      await this.leaveMatch(this.getUserId(client), payload.matchId);
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
