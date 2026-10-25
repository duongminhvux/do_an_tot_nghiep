import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { SiteSettingsService } from './site-settings.service.js';
import { UpdateSiteSettingsDto } from './site-settings.dto.js';

@Controller('site-settings')
export class PublicSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Public() @Get() read() {
    return this.settings.read();
  }
}
@AdminController('site-settings')
export class AdminSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Get() read() {
    return this.settings.read();
  }
  @Get('timezones') timezones(@Query('lang') lang?: string) {
    return this.settings.timezones(lang);
  }
  @Put() save(@Body() input: UpdateSiteSettingsDto) {
    return this.settings.save(input);
  }
}
