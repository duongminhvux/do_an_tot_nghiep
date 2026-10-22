import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { AttemptsService } from './attempts.service.js';
import { QueryAttemptDto } from './dto/query-attempt.dto.js';
import { CreateAttemptDto } from './dto/create-attempt.dto.js';
import {
  CheckAnswerDto,
  AudioPlayDto,
  SaveAnswerDto,
  UpdateAttemptDto,
} from './dto/update-attempt.dto.js';

type UserRequest = { user: { _id: string } };

@Controller('exams')
export class ExamPartsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Get(':id/parts')
  parts(@Param('id') id: string) {
    return this.attemptsService.availableParts(id);
  }
}

@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post()
  create(@Req() req: UserRequest, @Body() dto: CreateAttemptDto) {
    return this.attemptsService.create(String(req.user._id), dto);
  }

  @Get()
  findAll(@Req() req: UserRequest, @Query() query: QueryAttemptDto) {
    return this.attemptsService.findAll(String(req.user._id), query);
  }

  @Get('stats')
  stats(@Req() req: UserRequest, @Query() query: QueryAttemptDto) {
    return this.attemptsService.stats(String(req.user._id), query);
  }

  @Get(':id')
  findOne(@Req() req: UserRequest, @Param('id') id: string) {
    return this.attemptsService.findOne(String(req.user._id), id);
  }

  @Patch(':id/answers')
  saveAnswer(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.attemptsService.saveAnswer(String(req.user._id), id, dto);
  }

  @Patch(':id/progress')
  update(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAttemptDto,
  ) {
    return this.attemptsService.update(String(req.user._id), id, dto);
  }

  @Post(':id/check-answer')
  check(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() dto: CheckAnswerDto,
  ) {
    return this.attemptsService.checkAnswer(
      String(req.user._id),
      id,
      dto.questionId,
    );
  }

  @Post(':id/audio-plays')
  playAudio(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() dto: AudioPlayDto,
  ) {
    return this.attemptsService.playAudio(String(req.user._id), id, dto);
  }

  @Post(':id/abandon')
  abandon(@Req() req: UserRequest, @Param('id') id: string) {
    return this.attemptsService.abandon(String(req.user._id), id);
  }

  @Post(':id/submit')
  submit(@Req() req: UserRequest, @Param('id') id: string) {
    return this.attemptsService.submit(String(req.user._id), id);
  }
}
