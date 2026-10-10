import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
} from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service.js';
import { CreateActivityLogDto } from './dto/create-activity-log.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async recordActivity(
    @Body() dto: CreateActivityLogDto,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    let authUser = req.user;
    if (!authUser && req.headers?.authorization?.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.substring(7);
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          authUser = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
        }
      } catch {
        // ignore invalid token parsing
      }
    }

    if (authUser) {
      dto.userId = dto.userId || authUser._id || authUser.sub || authUser.id;
      dto.userEmail = dto.userEmail || authUser.email;
      dto.userName = dto.userName || authUser.username;
      dto.role = dto.role || authUser.role || 'USER';
    }

    // Capture network and device metadata
    dto.ipAddress =
      dto.ipAddress ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      ip;
    dto.userAgent = dto.userAgent || userAgent;

    const log = await this.activityLogsService.log(dto);
    return {
      success: true,
      logged: Boolean(log),
    };
  }

  /**
   * Specialized lightweight endpoint for navigator.sendBeacon when closing tab/exiting website
   */
  @Public()
  @Post('beacon')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordBeacon(
    @Body() dto: CreateActivityLogDto,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    let authUser = req.user;
    if (!authUser && req.headers?.authorization?.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.substring(7);
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          authUser = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
        }
      } catch {
        // ignore invalid token parsing
      }
    }

    if (authUser) {
      dto.userId = dto.userId || authUser._id || authUser.sub || authUser.id;
      dto.userEmail = dto.userEmail || authUser.email;
      dto.userName = dto.userName || authUser.username;
      dto.role = dto.role || authUser.role || 'USER';
    }

    dto.ipAddress =
      dto.ipAddress ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      ip;
    dto.userAgent = dto.userAgent || userAgent;

    await this.activityLogsService.log(dto);
  }
}
