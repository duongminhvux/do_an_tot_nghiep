import { Transform,Type } from 'class-transformer';
import {
IsDateString,
IsEnum,
IsInt,
IsOptional,
IsString,
IsUUID,
Max,
Min
} from 'class-validator';
import { MiniGameType } from '../minigame.types.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class MiniGameResultQueryDto {
  @IsOptional()
  @IsEnum(MiniGameType)
  gameType?: MiniGameType;

  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsEnum(['score_desc', 'score_asc', 'newest', 'oldest'])
  sort: 'score_desc' | 'score_asc' | 'newest' | 'oldest' = 'newest';
}

export class TopScoresQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
