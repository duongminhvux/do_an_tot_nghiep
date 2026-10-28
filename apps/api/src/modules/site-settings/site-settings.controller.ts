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
import { UpdateSiteSettingsDto } from './site-settings.dto.js';
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
}
@AdminController('site-settings')
export class AdminSiteSettingsController {
  constructor(
    @Inject(SiteSettingsService) private readonly settings: SiteSettingsService,
  ) {}
  @Get('recommendations') readRecommendations() {
    return this.settings.readRecommendations();
  }
  @Put('recommendations') saveRecommendations(
    @Body() input: RecommendationRulesDto,
  ) {
    return this.settings.saveRecommendations(input);
  }
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
