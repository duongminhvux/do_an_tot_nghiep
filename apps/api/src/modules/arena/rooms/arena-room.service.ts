import { PgId } from '../../../postgres/compat.js';
import { ArenaSettingsService } from '../admin/arena-settings.service.js';
import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { Injectable, Optional, ForbiddenException } from '@nestjs/common';
import { InjectPgModel } from '../../../postgres/compat.js';
import { WsException } from '@nestjs/websockets';
import { type Model } from '../../../postgres/compat.js';
import { ArenaRoom, ArenaRoomDocument } from '../schemas/arena-room.schema.js';

@Injectable()
export class ArenaRoomService {
  constructor(
    @InjectPgModel(ArenaRoom.name)
    private readonly roomModel: Model<ArenaRoomDocument>,
    @Optional() private readonly settings?: ArenaSettingsService,
  ) {}

  /** Tạo phòng chờ dùng chung cho friend và room match. */
  async createRoom(
    ownerId: string,
    options: {
      name: string;
      visibility?: 'PUBLIC' | 'PRIVATE';
      questionMode?: 'MIXED' | 'MEANING' | 'ENGLISH' | 'LISTENING' | 'CONTEXT';
      questionCount?: number;
      secondsPerQuestion?: number;
      maxPlayers?: number;
    },
  ) {
    if (
      options.maxPlayers !== undefined &&
      (!Number.isInteger(options.maxPlayers) ||
        options.maxPlayers < 3 ||
        options.maxPlayers > 8)
    )
      throw new WsException('INVALID_ROOM_CAPACITY');
    const config = this.settings
      ? await this.settings.current()
      : ARENA_DEFAULTS;
    if (config.maintenance || !config.group.enabled)
      throw new ForbiddenException('ARENA_UNAVAILABLE');
    if (options.maxPlayers && options.maxPlayers > config.group.maxPlayers)
      throw new WsException('INVALID_ROOM_CAPACITY');
    const code = await this.generateCode();
    return this.roomModel.create({
      name: options.name.trim(),
      code,
      ownerId: new PgId(ownerId),
      visibility: options.visibility ?? 'PRIVATE',
      questionMode: options.questionMode ?? 'MIXED',
      questionCount: options.questionCount ?? 20,
      secondsPerQuestion: options.secondsPerQuestion ?? 15,
      maxPlayers: options.maxPlayers ?? config.group.maxPlayers,
      members: [
        {
          userId: new PgId(ownerId),
          role: 'HOST',
          isReady: false },
      ] });
  }

  /** Thêm người chơi atomically và không vượt quá giới hạn phòng. */
  async joinRoom(roomCode: string, userId: string) {
    const room = await this.roomModel.findOneAndUpdate(
      {
        code: roomCode.trim().toUpperCase(),
        status: 'WAITING',
        $expr: { $lt: [{ $size: '$members' }, '$maxPlayers'] },
        'members.userId': { $ne: new PgId(userId) } },
      {
        $push: {
          members: {
            userId: new PgId(userId),
            role: 'PLAYER',
            isReady: false } } },
      { returnDocument: 'after' },
    );
    if (!room) throw new WsException('Room is unavailable');
    return room;
  }

  /** Sinh code dễ đọc và kiểm tra collision qua unique index. */
  private async generateCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      if (!(await this.roomModel.exists({ code }))) return code;
    }
    throw new WsException('Unable to create room code');
  }
}
