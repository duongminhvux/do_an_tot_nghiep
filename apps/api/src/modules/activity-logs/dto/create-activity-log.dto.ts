import { IsEnum, IsNumber, IsObject, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { ActivityCategory } from '../schemas/activity-log.schema.js';

export class CreateActivityLogDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(/^activity-log\.messages\.[A-Z0-9_]+$/)
  descriptionKey?: string;

  @IsOptional()
  @IsObject()
  descriptionArgs?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userEmail?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsString()
  action!: string;

  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;

  @ValidateIf((dto: CreateActivityLogDto, value) => value !== undefined || !dto.descriptionKey)
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  durationMs?: number;
}
