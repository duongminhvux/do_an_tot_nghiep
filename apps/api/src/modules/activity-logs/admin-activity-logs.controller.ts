import {
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { ActivityLogsService } from './activity-logs.service.js';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto.js';
import { QueryActivityStatsDto } from './dto/query-activity-stats.dto.js';

@AdminController('activity-logs')
export class AdminActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  async getLogs(@Query() query: QueryActivityLogsDto) {
    return this.activityLogsService.findAll(query);
  }

  @Get('stats')
  async getStats(@Query() query: QueryActivityStatsDto) {
    return this.activityLogsService.getStats(query, query.lang);
  }

  @Get('filters')
  async getFilterOptions(@Query('lang') lang?: string) {
    return this.activityLogsService.getFilterOptions(lang);
  }

  @Get('i18n')
  async getI18n(@Query('lang') lang?: string) {
    return this.activityLogsService.getI18n(lang);
  }

  @Get(':id')
  async getLogById(@Param('id') id: string, @Query('lang') lang?: string) {
    const log = await this.activityLogsService.findById(id, lang);
    if (!log) {
      throw new NotFoundException(`Activity log with id "${id}" not found`);
    }
    return log;
  }
}
