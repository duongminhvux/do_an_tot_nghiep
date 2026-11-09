import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import {
Body,
Controller,
Get,
Inject,
Post,
Put,
Query,
} from '@nestjs/common';
import {
buildRecommendations,
recommendationScenario,
} from '@repo/shared-types/recommendations';
import { IsIn } from 'class-validator';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { RecommendationRulesDto } from '../learning/recommendations/recommendation-rules.dto.js';
import { RecommendationLanguageDto } from '../learning/recommendations/recommendations.controller.js';
import {
UpdateLandingPageSettingsDto,
UpdateSiteSettingsDto,
} from './site-settings.dto.js';
import { SiteSettingsService } from './site-settings.service.js';

export class RecommendationPreviewQueryDto extends RecommendationLanguageDto {
  @IsIn(['new', 'little', 'progress']) scenario: 'new' | 'little' | 'progress';
}

@Controller('site-settings')
export class PublicSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Public() @Get() read() {
    return this.settings.read();
  }
  @Public() @Get('landing') readLanding() {
    return this.settings.readLanding();
  }
}
@AdminController('site-settings')
export class AdminSiteSettingsController {
  constructor(
    @Inject(SiteSettingsService) private readonly settings: SiteSettingsService,
  ) {}
  @RequirePermissions('settings.recommendations.read')
  @Get('recommendations') readRecommendations() {
    return this.settings.readRecommendations();
  }
  @RequirePermissions('settings.recommendations.update')
  @Put('recommendations') saveRecommendations(
    @Body() input: RecommendationRulesDto,
  ) {
    return this.settings.saveRecommendations(input);
  }
  @RequirePermissions('settings.recommendations.read')
  @Post('recommendations/preview') previewRecommendations(
    @Body() input: RecommendationRulesDto,
    @Query() query: RecommendationPreviewQueryDto,
  ) {
    return buildRecommendations(
      recommendationScenario(query.scenario),
      input,
      query.lang,
    );
  }
  @RequirePermissions('settings.read')
  @Get() read() {
    return this.settings.read();
  }
  @RequirePermissions('settings.landing.read')
  @Get('landing') readLanding() {
    return this.settings.readLanding();
  }
  @RequirePermissions('settings.landing.update')
  @Put('landing') saveLanding(@Body() input: UpdateLandingPageSettingsDto) {
    return this.settings.saveLanding(input);
  }
  @RequirePermissions('settings.read')
  @Get('timezones') timezones(@Query('lang') lang?: string) {
    return this.settings.timezones(lang);
  }
  @RequirePermissions('settings.update')
  @Put() save(@Body() input: UpdateSiteSettingsDto) {
    return this.settings.save(input);
  }
}
