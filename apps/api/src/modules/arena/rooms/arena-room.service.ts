import { ForbiddenException,Injectable,Optional } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { first,rowData,sql,SqlTable } from '../../../postgres/sql.js';
import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { ArenaSettingsService } from '../admin/arena-settings.service.js';

@Injectable()
export class ArenaRoomService {
  constructor(
    @InjectPgConnection() private readonly db: PgConnection,
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
    return new SqlTable(this.db,'arenarooms',{name:'name',code:'code',ownerId:'owner_id',status:'status',visibility:'visibility',
      questionMode:'question_mode',questionCount:'question_count',secondsPerQuestion:'seconds_per_question',maxPlayers:'max_players',members:'members',vocabularySource:'vocabulary_source'},
      ['members']).insert({status:'WAITING',vocabularySource:'GLOBAL',
      name: options.name.trim(),
      code,
      ownerId: ownerId,
      visibility: options.visibility ?? 'PRIVATE',
      questionMode: options.questionMode ?? 'MIXED',
      questionCount: options.questionCount ?? 20,
      secondsPerQuestion: options.secondsPerQuestion ?? 15,
      maxPlayers: options.maxPlayers ?? config.group.maxPlayers,
      members: [
        {
          userId: ownerId,
          role: 'HOST',
          isReady: false },
      ] });
  }

  /** Thêm người chơi atomically và không vượt quá giới hạn phòng. */
  async joinRoom(roomCode: string, userId: string) {
    const member={userId,role:'PLAYER',isReady:false,joinedAt:new Date()};
    const raw=await first(this.db,sql`UPDATE public.arenarooms SET members=COALESCE(members,'[]'::jsonb)||${JSON.stringify([member])}::jsonb,
      payload=payload-'members' WHERE code=${roomCode.trim().toUpperCase()} AND status='WAITING'
      AND jsonb_array_length(COALESCE(members,'[]'::jsonb))<max_players
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(members,'[]'::jsonb)) m WHERE m->>'userId'=${userId}) RETURNING *`);
    const room=raw?rowData<any>(raw):null;
    if (!room) throw new WsException('Room is unavailable');
    return room;
  }

  /** Sinh code dễ đọc và kiểm tra collision qua unique index. */
  private async generateCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      if (!await first(this.db,sql`SELECT 1 FROM public.arenarooms WHERE code=${code}`)) return code;
    }
    throw new WsException('Unable to create room code');
  }
}
