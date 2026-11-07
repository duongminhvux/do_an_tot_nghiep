import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { BadRequestException, Get, Header, Headers, Module, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
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
import { QUALITY_GROUPS, QUALITY_KINDS, type QualityCategory, type QualityGroup } from './quality-rules.js';
import type { QualityArea } from './content-quality.service.js';
export class QualityQuery {
  /** Legacy category filter (kept for compatibility). */
  @IsOptional()
  @IsIn(['DATA', 'MEDIA', 'DUPLICATE', 'FEEDBACK'])
  category?: QualityCategory;
  @IsOptional() @IsIn(['toeic', 'dictation', 'vocabulary']) area?: QualityArea;
  @IsOptional() @IsIn(['error', 'warning']) severity?: 'error' | 'warning';
  @IsOptional() @IsIn(QUALITY_GROUPS) group?: QualityGroup;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(['severity', 'recent']) sort?: 'severity' | 'recent';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @IsIn(['vi', 'en']) lang = 'vi';
}
export class RecheckQuery {
  @IsOptional() @IsIn(['vi', 'en']) lang = 'vi';
}
export class QualitySourceQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsISO8601() before!: string;
}
@AdminController('content-quality')
export class ContentQualityController {
  constructor(private readonly quality: ContentQualityService) {}
  @RequirePermissions('content_quality.read')
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: QualityQuery) {
    return this.quality.list(query);
  }
  /** Check one content item again (no full scan). */
  @RequirePermissions('content_quality.scan')
  @Post('items/:kind/:id/recheck')
  recheck(
    @Param('kind') kind: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: { user: { _id: string } },
    @Query() query: RecheckQuery,
  ) {
    if (!(QUALITY_KINDS as string[]).includes(kind))
      throw new BadRequestException('Unsupported content type');
    return this.quality.recheck(kind, id, String(request.user._id), query.lang);
  }
  @RequirePermissions('content_quality.scan')
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
  /** One exam for a single-content recheck; null when it was deleted. */
  @Public()
  @Get('exams/:id')
  @Header('Cache-Control', 'private, no-store')
  one(
    @Headers('x-internal-token') token: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    // The global response envelope adds { data } (same as the batch route).
    authorizeRecommendationSummary(token, ['assessment']);
    return this.source.one('exams', id);
  }
}
@Module({
  imports: [PublicationModule],
  providers: [QualitySourceService, QualityMediaService, ContentQualityService],
  controllers: [ContentQualityController, QualitySourceController],
})
export class ContentQualityModule {}
