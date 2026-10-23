import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsUUID,
  IsOptional,
  IsString,
  IsTimeZone,
  Max,
  Min } from 'class-validator';

export class QueryAttemptDto {
  @IsOptional() @IsString() examId?: string;
  @IsOptional() @IsIn(['TEST', 'PRACTICE']) mode?: 'TEST' | 'PRACTICE';
  @IsOptional()
  @IsIn(['IN_PROGRESS', 'FINISHED', 'COMPLETED', 'ABANDONED'])
  status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number =
    100;
  @IsOptional() @IsIn(['newest', 'oldest']) sort?: 'newest' | 'oldest';
  // Stats only: restrict to the last N days and compare with the N days before.
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
  // Stats only: IANA zone used to bucket the daily timeline.
  @IsOptional() @IsTimeZone() timezone?: string;
}

export class AdminQueryAttemptDto extends QueryAttemptDto {
  @IsOptional() @IsUUID('4') userId?: string;
}
