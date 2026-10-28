import { Body,Controller,Get,Post,Query,Req } from '@nestjs/common';
import { ACTIVE_TIME_MAX_SLICE_MS } from '@repo/shared-types/active-time';
import { Type } from 'class-transformer';
import {
IsDate,
IsInt,
IsOptional,
IsTimeZone,
IsUUID,
Max,
Min
} from 'class-validator';
import { ActiveTimeService } from './active-time.service.js';
import { LearningActivityService } from './learning-activity.service.js';

type UserRequest = { user: { _id: string } };

class HomeQueryDto {
  @IsOptional() @IsTimeZone() timezone?: string;
}

class RecentQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @Type(() => Date) @IsDate() before?: Date;
}

export class ActiveTimePulseDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(0) @Max(ACTIVE_TIME_MAX_SLICE_MS) activeMs!: number;
}

@Controller('learning-activity')
export class LearningActivityController {
  constructor(private readonly activities: LearningActivityService, private readonly activeTime: ActiveTimeService) {}

  @Post('active-time')
  recordActiveTime(@Req() req: UserRequest, @Body() pulse: ActiveTimePulseDto) {
    return this.activeTime.record(String(req.user._id), pulse);
  }

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
