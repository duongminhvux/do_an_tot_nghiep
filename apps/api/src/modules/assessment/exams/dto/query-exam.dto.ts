import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ExamType } from './create-exam.dto.js';

import {PublicationFilterDto} from '../../../publication/publication.dto.js';
export class QueryExamDto extends PublicationFilterDto {
  @IsOptional()
  @IsIn(['name', 'totalQuestions', 'durationMinutes', 'order', 'isActive'])
  sortBy?: 'name' | 'totalQuestions' | 'durationMinutes' | 'order' | 'isActive';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsEnum(ExamType)
  @IsOptional()
  type?: ExamType;

  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  groupId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
