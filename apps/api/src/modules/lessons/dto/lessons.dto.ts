import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Min,
} from "class-validator";
import { LessonResourceType } from "../../../generated/prisma/client";

export class CreateLessonDto {
  @ApiProperty()
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDurationMinutes?: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex!: number;
}

export class UpdateLessonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class SaveLessonDraftDto extends CreateLessonDto {
  @IsArray()
  vocabulary!: Array<{
    word: string;
    ipa?: string;
    meaning: string;
    example?: string;
  }>;

  @IsArray()
  expressions!: Array<{
    expression: string;
    meaning: string;
    example?: string;
  }>;

  @IsArray()
  resources!: Array<{
    type: LessonResourceType;
    title: string;
    mediaId?: string;
    externalUrl?: string;
  }>;
}

export class VocabularyDto {
  @ApiProperty()
  @IsString()
  word!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipa?: string;

  @ApiProperty()
  @IsString()
  meaning!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  example?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex!: number;
}

export class ExpressionDto {
  @ApiProperty()
  @IsString()
  expression!: string;

  @ApiProperty()
  @IsString()
  meaning!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  example?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex!: number;
}

export class LessonResourceDto {
  @ApiProperty({ enum: LessonResourceType })
  @IsEnum(LessonResourceType)
  type!: LessonResourceType;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  mediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  externalUrl?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex!: number;
}
