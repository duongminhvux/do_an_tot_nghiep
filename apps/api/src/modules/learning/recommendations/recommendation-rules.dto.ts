import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import type {
  RecommendationRules,
  RecommendationSource,
} from '@repo/shared-types/recommendations';

export class RecommendationRulesDto implements RecommendationRules {
  @IsBoolean() enabled: boolean;
  @IsInt() @Min(1) @Max(3) maxSuggestions: number;
  @IsInt() @Min(2) @Max(30) minSamples: number;
  @IsInt() @Min(5) @Max(200) minQuestions: number;
  @IsInt() @Min(1) @Max(99) weakAccuracy: number;
  @IsBoolean() prioritizeDue: boolean;
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(['vocabulary', 'toeic', 'dictation'], { each: true })
  sources: RecommendationSource[];
}
