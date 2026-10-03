import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DictationLevel } from '../schemas/dictation-lesson.schema.js';

export class CreateDictationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(DictationLevel)
  level!: DictationLevel;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  topic?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50_000)
  sourceText!: string;

  @IsOptional()
  @IsIn(['en-US', 'en-GB'])
  language: 'en-US' | 'en-GB' = 'en-US';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  voiceIds: string[] = ['af_heart'];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speed: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  pauseAfterMs: number = 300;
}
