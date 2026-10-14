import {
  Body,
  Controller,
  Get,
  Req,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Post,
  Param,
} from '@nestjs/common';
import { ArenaService } from './arena.service.js';
import { ArenaFriendlyService } from './friendly/arena-friendly.service.js';
import { ArenaFriendMode } from './schemas/arena-match.schema.js';
import { ArenaReadService } from './arena-read.service.js';
import { ArenaGateway } from './gateways/arena.gateway.js';
import { ArenaRoomService } from './rooms/arena-room.service.js';
import { ArenaPresenceService } from './presence/arena-presence.service.js';
import {
  CreateArenaRoomDto,
  CreateFriendMatchDto,
  JoinArenaRoomDto,
} from './dto/arena-match.dto.js';

type ArenaRequest = { user: { _id: string } };

@Controller('arena')
export class ArenaController {
  constructor(
    private readonly presence: ArenaPresenceService,
    private readonly friendly: ArenaFriendlyService,
    private readonly arenaService: ArenaService,
    private readonly arenaReadService: ArenaReadService,
    private readonly arenaGateway: ArenaGateway,
    private readonly arenaRoomService: ArenaRoomService,
  ) {}

  @Get('presence')
  getPresence() {
    return this.presence.overview();
  }

  @Post('matches/:matchId/leave')
  leaveMatch(@Req() req: ArenaRequest, @Param('matchId') matchId: string) {
    return this.arenaGateway.leaveMatch(String(req.user._id), matchId);
  }

  @Get('friend/players')
  getFriendlyPlayers(@Req() req: ArenaRequest, @Query('search') search = '') {
    return this.friendly.candidates(String(req.user._id), search);
  }

  /** Trả về tổng quan Arena của người dùng đã đăng nhập. */
  @Get('profile')
  getProfile(@Req() req: ArenaRequest) {
    return this.arenaService.getMyArenaOverview(String(req.user._id));
  }

  /** Trả về danh sách các trận đã hoàn thành gần đây. */
  @Get('matches')
  getMatches(
    @Req() req: ArenaRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.arenaReadService.getRecentMatches(String(req.user._id), limit);
  }

  /** Trả về leaderboard theo khoảng thời gian được yêu cầu. */
  @Get('leaderboard')
  getLeaderboard(
    @Req() req: ArenaRequest,
    @Query('period') period = 'week',
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.arenaReadService.getLeaderboard(
      String(req.user._id),
      period,
      limit,
    );
  }

  /** Tạo duel FRIEND dùng chung match lifecycle nhưng không đổi Elo. */
  @Post('friend/matches')
  createFriendMatch(
    @Req() req: ArenaRequest,
    @Body() body: CreateFriendMatchDto,
  ) {
    return this.arenaGateway.inviteUser(
      String(req.user._id),
      body.opponentId,
      body.mode ?? ArenaFriendMode.CLASSIC,
    );
  }

  /** Tạo phòng chờ để các flow friend/room dùng chung. */
  @Post('rooms')
  createRoom(@Req() req: ArenaRequest, @Body() body: CreateArenaRoomDto) {
    return this.arenaRoomService.createRoom(String(req.user._id), body);
  }

  /** Tham gia phòng bằng code với thao tác atomic chống vượt maxPlayers. */
  @Post('rooms/join')
  joinRoom(@Req() req: ArenaRequest, @Body() body: JoinArenaRoomDto) {
    return this.arenaRoomService.joinRoom(body.code, String(req.user._id));
  }
}
