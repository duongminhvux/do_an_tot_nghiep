import { Module } from '@nestjs/common';
import {
AdminSiteSettingsController,
PublicSiteSettingsController,
} from './site-settings.controller.js';
import { SiteSettingsService } from './site-settings.service.js';
@Module({
  providers: [SiteSettingsService],
  controllers: [AdminSiteSettingsController, PublicSiteSettingsController],
})
export class SiteSettingsModule {}
