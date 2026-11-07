import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class ReviewLibraryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
  @IsOptional() @IsIn(['ALL', 'DUE', 'LEARNING', 'MASTERED']) status = 'ALL';
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;
}
export class PracticeWordsDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() wordId?: string;
  @IsOptional() @IsIn(['ALL', 'DUE', 'LEARNING', 'MASTERED']) status = 'ALL';
}
export class RecordWordReviewDto {
  @IsUUID() wordId!: string;
  @IsIn(['AGAIN', 'HARD', 'GOOD', 'EASY']) rating!:
    'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
}
