import { ReviewLibraryDto, PracticeWordsDto, RecordWordReviewDto } from './dto/review-library.dto.js';
import {
Body,
Controller,
Get,
Post,
Query,
Req,
UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ReviewsService } from './reviews.service.js';

@Controller(['reviews', 'learning/reviews'])
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('check-due')
  checkDue(@Req() req: any) {
    return this.reviewsService.checkDue(req.user._id);
  }

  @Post('record')
  recordReview(
    @Req() req: any,
    @Body() body: RecordWordReviewDto,
  ) {
    return this.reviewsService.recordReview(
      req.user._id,
      body.wordId,
      body.rating,
    );
  }

  @Get('library')
  library(@Req() req: any, @Query() query: ReviewLibraryDto) {
    return this.reviewsService.library(req.user._id, query);
  }
  @Get('practice')
  practice(@Req() req: any, @Query() query: PracticeWordsDto) {
    return this.reviewsService.practice(req.user._id, query);
  }
  @Get('due')
  getDueReviews(
    @Req() req: any,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getDueReviews(req.user._id, limit ? Number(limit) : 30);
  }

  @Get('stats')
  getStats(@Req() req: any) {
    return this.reviewsService.getStats(req.user._id);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
  ) {
    return this.reviewsService.findAll(req.user._id, status);
  }
}
