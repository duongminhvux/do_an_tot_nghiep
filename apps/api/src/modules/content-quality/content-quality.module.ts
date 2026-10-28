import { Get, Header, Headers, Module, Post, Query, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Controller } from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { authorizeRecommendationSummary } from '../../internal/recommendation-summary.controller.js';
import { PublicationModule } from '../publication/publication.module.js';
import { ContentQualityService } from './content-quality.service.js';
import { QualitySourceService } from './quality-source.service.js';
import { QualityMediaService } from './quality-media.service.js';
import type { QualityCategory } from './quality-rules.js';
export class QualityQuery {
  @IsOptional()
  @IsIn(['DATA', 'MEDIA', 'DUPLICATE', 'FEEDBACK'])
  category?: QualityCategory;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @IsIn(['vi', 'en']) lang = 'vi';
}
export class QualitySourceQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsISO8601() before!: string;
}
@AdminController('content-quality')
export class ContentQualityController {
  constructor(private readonly quality: ContentQualityService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: QualityQuery) {
    return this.quality.list(query.category, query.page, query.lang);
  }
  @Post('scans')
  scan(@Req() request: { user: { _id: string } }) {
    return this.quality.enqueue(String(request.user._id));
  }
}
@Controller('_internal/content-quality')
export class QualitySourceController {
  constructor(private readonly source: QualitySourceService) {}
  @Public()
  @Get('exams')
  @Header('Cache-Control', 'private, no-store')
  batch(
    @Headers('x-internal-token') token: string,
    @Query() query: QualitySourceQuery,
  ) {
    authorizeRecommendationSummary(token, ['assessment']);
    return this.source.batch('exams', query.cursor ?? null, query.before);
  }
}
@Module({
  imports: [PublicationModule],
  providers: [QualitySourceService, QualityMediaService, ContentQualityService],
  controllers: [ContentQualityController, QualitySourceController],
})
export class ContentQualityModule {}
