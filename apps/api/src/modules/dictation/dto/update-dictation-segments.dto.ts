import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DictationSegmentEditDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  text!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  startMs!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  endMs!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  speaker?: string;
}

export class UpdateDictationSegmentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DictationSegmentEditDto)
  segments!: DictationSegmentEditDto[];
}
