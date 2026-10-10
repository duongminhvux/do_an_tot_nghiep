import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { DictationService } from './dictation.service.js';
import { QueryDictationDto } from './dto/query-dictation.dto.js';
import { DictationAttemptDto } from './dto/dictation-attempt.dto.js';
import { DictationSegmentActionDto } from './dto/dictation-progress-action.dto.js';

@Controller('dictation')
export class DictationController {
  constructor(private readonly dictationService: DictationService) {}

  @Get('topics')
  topics(@Req() req: any) {
    return this.dictationService.listPublishedTopics(req.user._id);
  }

  @Get('topics/:slug')
  topic(@Req() req: any, @Param('slug') slug: string) {
    return this.dictationService.getPublishedTopicBySlug(slug, req.user._id);
  }

  @Get()
  list(@Req() req: any, @Query() query: QueryDictationDto) {
    return this.dictationService.listPublished(req.user._id, query);
  }

  @Get('progress')
  progressOverview(@Req() req: any) {
    return this.dictationService.progressOverview(req.user._id);
  }

  @Get('slug/:slug')
  getBySlug(@Req() req: any, @Param('slug') slug: string) {
    return this.dictationService.getPublishedBySlug(slug, req.user._id);
  }

  @Get(':id/progress')
  getProgress(@Req() req: any, @Param('id') id: string) {
    return this.dictationService.getProgress(req.user._id, id);
  }

  @Post(':id/progress/attempt')
  recordAttempt(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: DictationAttemptDto,
  ) {
    return this.dictationService.recordAttempt(
      req.user._id,
      id,
      dto.segmentIndex,
      dto.isCorrect,
    );
  }

  @Post(':id/progress/reveal-segment')
  revealSegment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: DictationSegmentActionDto,
  ) {
    return this.dictationService.revealSegment(req.user._id, id, dto.segmentIndex);
  }

  @Post(':id/progress/reveal-transcript')
  revealTranscript(@Req() req: any, @Param('id') id: string) {
    return this.dictationService.revealTranscript(req.user._id, id);
  }

  @Post(':id/progress/replay')
  replay(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: DictationSegmentActionDto,
  ) {
    return this.dictationService.recordReplay(req.user._id, id, dto.segmentIndex);
  }

  @Post(':id/progress/reset')
  resetProgress(@Req() req: any, @Param('id') id: string) {
    return this.dictationService.resetProgress(req.user._id, id);
  }
}
