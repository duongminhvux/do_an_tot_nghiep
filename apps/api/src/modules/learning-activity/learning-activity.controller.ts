import { Controller, Get, Query, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsTimeZone,
  Max,
  Min,
} from 'class-validator';
import { LearningActivityService } from './learning-activity.service.js';

type UserRequest = { user: { _id: string } };

class HomeQueryDto {
  @IsOptional() @IsTimeZone() timezone?: string;
}

class RecentQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @Type(() => Date) @IsDate() before?: Date;
}

@Controller('learning-activity')
export class LearningActivityController {
  constructor(private readonly activities: LearningActivityService) {}

  @Get('home')
  home(@Req() req: UserRequest, @Query() query: HomeQueryDto) {
    return this.activities.home(String(req.user._id), query.timezone);
  }

  @Get('recent')
  recent(@Req() req: UserRequest, @Query() query: RecentQueryDto) {
    return this.activities.recent(
      String(req.user._id),
      query.limit,
      query.before,
    );
  }
}
