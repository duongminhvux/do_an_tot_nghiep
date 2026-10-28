import { Controller,Get,Header,Inject,Query,Req } from '@nestjs/common';
import { IsIn,IsOptional } from 'class-validator';
import { RecommendationsService } from './recommendations.service.js';

export class RecommendationLanguageDto {
  @IsOptional() @IsIn(['vi', 'en']) lang?: string;
}
@Controller('learning/recommendations')
export class RecommendationsController {
  constructor(
    @Inject(RecommendationsService)
    private readonly recommendations: RecommendationsService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Req() request: { user: { _id: string } },
    @Query() query: RecommendationLanguageDto,
  ) {
    return this.recommendations.list(
      String(request.user._id),
      query.lang ?? 'vi',
    );
  }
}
