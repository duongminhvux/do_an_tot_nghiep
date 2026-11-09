import {
  IsString,
  IsOptional,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDictationDto } from './create-dictation.dto.js';
import { DictationSegmentEditDto } from './update-dictation-segments.dto.js';
export class YoutubePreviewDto {
  @IsString() @MaxLength(1000) url: string;
  @IsOptional() @IsString() @MaxLength(500000) subtitleText?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(7200) startSeconds?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(7200) endSeconds?: number;
}
export class CreateYoutubeDictationDto extends CreateDictationDto {
  @IsString() @MaxLength(1000) youtubeUrl: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DictationSegmentEditDto)
  segments: DictationSegmentEditDto[];
}
