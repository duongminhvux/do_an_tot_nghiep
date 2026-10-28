import { Get,Query } from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { DashboardService } from './dashboard.service.js';

@AdminController('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview(@Query('days') days?: string, @Query('lang') lang?: string) {
    return this.dashboardService.getOverview(Number(days) || 7, lang);
  }
}
