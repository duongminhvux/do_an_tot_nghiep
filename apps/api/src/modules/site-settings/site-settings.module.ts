import { Module } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service.js';
import {
  AdminSiteSettingsController,
  PublicSiteSettingsController,
} from './site-settings.controller.js';
@Module({
  providers: [SiteSettingsService],
  controllers: [AdminSiteSettingsController, PublicSiteSettingsController],
})
export class SiteSettingsModule {}
