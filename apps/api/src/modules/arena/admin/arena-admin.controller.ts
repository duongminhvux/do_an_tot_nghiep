import { Body, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { ArenaAdminService } from './arena-admin.service.js';
import { ArenaSettingsService } from './arena-settings.service.js';
import {
  AdminReasonDto,
  ArenaAdminQuery,
  ArenaDashboardQuery,
  ArenaPlayerQuery,
  ArenaRoomQuery,
  UpdateArenaSettingsDto } from './arena-admin.dto.js';
type AdminRequest = { user: { _id: string } };
@AdminController('arena')
export class ArenaAdminController {
  constructor(
    private readonly arena: ArenaAdminService,
    private readonly settings: ArenaSettingsService,
  ) {}
  @Get('dashboard') dashboard(@Query() query: ArenaDashboardQuery) {
    return this.arena.dashboard(query);
  }
  @Get('matches') matches(@Query() query: ArenaAdminQuery) {
    return this.arena.matchList(query);
  }
  @Get('matches/:id') match(@Param('id') id: string) {
    return this.arena.matchDetail(id);
  }
  @Get('players') players(@Query() query: ArenaPlayerQuery) {
    return this.arena.playerList(query);
  }
  @Get('players/:id') player(@Param('id') id: string) {
    return this.arena.playerDetail(id);
  }
  @Get('players/:id/matches') history(
    @Param('id') id: string,
    @Query() query: ArenaAdminQuery,
  ) {
    return this.arena.matchList(Object.assign(query, { userId: id }));
  }
  @Get('players/:id/rating-history') ratings(
    @Param('id') id: string,
    @Query() query: ArenaAdminQuery,
  ) {
    return this.arena.ratingHistory(id, query);
  }
  @Get('rooms') rooms(@Query() query: ArenaRoomQuery) {
    return this.arena.roomList(query);
  }
  @Get('rooms/:id') room(@Param('id') id: string) {
    return this.arena.roomDetail(id);
  }
  @Post('rooms/:id/close') close(
    @Param('id') id: string,
    @Body() dto: AdminReasonDto,
    @Req() req: AdminRequest,
  ) {
    return this.arena.closeRoom(id, String(req.user._id), dto.reason);
  }
  @Get('settings') config() {
    return this.settings.read();
  }
  @Put('settings') update(
    @Body() dto: UpdateArenaSettingsDto,
    @Req() req: AdminRequest,
  ) {
    return this.arena.updateSettings(dto, String(req.user._id));
  }
}
