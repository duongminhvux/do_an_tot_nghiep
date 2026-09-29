import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ProgressService } from './progress.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';

@Controller('learning/progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('dashboard-stats')
  getDashboardStats(
    @Req() req: any,
    @Query('timezoneOffset') timezoneOffset?: string,
  ) {
    return this.progressService.getDashboardStats(req.user._id, timezoneOffset);
  }

  @Get('lesson/:lessonId')
  getLessonProgress(
    @Req() req: any,
    @Param('lessonId') lessonId: string,
  ) {
    return this.progressService.getLessonProgress(req.user._id, lessonId);
  }

  @Get('lesson/:lessonId/sections')
  getLessonSections(
    @Req() req: any,
    @Param('lessonId') lessonId: string,
  ) {
    return this.progressService.getLessonSectionsProgress(req.user._id, lessonId);
  }

  @Get('lesson/:lessonId/study-words')
  getWordsStatus(
    @Req() req: any,
    @Param('lessonId') lessonId: string,
    @Query('excludeLearned') excludeLearned?: string,
    @Query('sectionId') sectionId?: string,
    @Query('excludeMastered') excludeMastered?: string,
  ) {
    // Mặc định excludeLearned là true (nếu user không chỉ định rõ false)
    const shouldExcludeLearned = excludeLearned !== 'false';
    return this.progressService.getWordsStatus(
      req.user._id,
      lessonId,
      shouldExcludeLearned,
      sectionId,
      excludeMastered === 'true',
    );
  }

  @Get('collection/:collectionId')
  getCollectionProgress(
    @Req() req: any,
    @Param('collectionId') collectionId: string,
  ) {
    return this.progressService.getCollectionProgress(req.user._id, collectionId);
  }

  @Get()
  getAllUserProgress(@Req() req: any) {
    return this.progressService.getAllUserProgress(req.user._id);
  }
}
