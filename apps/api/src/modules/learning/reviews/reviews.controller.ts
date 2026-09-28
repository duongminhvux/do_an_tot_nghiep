import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';

@Controller('learning/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

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
