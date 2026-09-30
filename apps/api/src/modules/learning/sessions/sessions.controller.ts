import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SessionsService } from './sessions.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { RecordActionDto } from './dto/record-action.dto.js';
import { CompleteSessionDto } from './dto/complete-session.dto.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';

@Controller('learning/sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Req() req: any, @Body() createSessionDto: CreateSessionDto) {
    return this.sessionsService.create(req.user._id, createSessionDto);
  }

  @Post('record-action')
  recordAction(@Req() req: any, @Body() recordActionDto: RecordActionDto) {
    return this.sessionsService.recordAction(req.user._id, recordActionDto);
  }

  @Post(':sessionId/words')
  recordSessionWord(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() recordActionDto: RecordActionDto,
  ) {
    return this.sessionsService.recordAction(req.user._id, {
      ...recordActionDto,
      sessionId,
    });
  }

  @Patch([':id', ':id/complete'])
  complete(
    @Req() req: any,
    @Param('id') id: string,
    @Body() completeSessionDto: CompleteSessionDto,
  ) {
    return this.sessionsService.complete(
      req.user._id,
      id,
      completeSessionDto?.endedAt,
    );
  }

  @Get()
  findAll(@Req() req: any) {
    return this.sessionsService.findAll(req.user._id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.sessionsService.findOne(req.user._id, id);
  }
}
