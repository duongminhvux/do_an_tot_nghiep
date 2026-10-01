import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ExamMode, ExamSection, ExamStatus, ExamType } from './create-exam.dto.js';

export class QueryExamDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(ExamType)
  @IsOptional()
  type?: ExamType;

  @IsEnum(ExamMode)
  @IsOptional()
  mode?: ExamMode;

  @IsEnum(ExamSection)
  @IsOptional()
  section?: ExamSection;

  @IsEnum(ExamStatus)
  @IsOptional()
  status?: ExamStatus;

  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

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
