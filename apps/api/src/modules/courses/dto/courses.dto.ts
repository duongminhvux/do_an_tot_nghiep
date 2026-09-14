import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";
import {
  ContentStatus,
  CourseVisibility,
  EnglishLevel,
} from "../../../generated/prisma/client";
import { PaginationQueryDto } from "../../../common/pagination/pagination.dto";

export class CourseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ enum: EnglishLevel })
  @IsOptional()
  @IsEnum(EnglishLevel)
  level?: EnglishLevel;
}

export class CreateCourseDto {
  @ApiProperty()
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsString()
  slug?: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ enum: EnglishLevel })
  @IsEnum(EnglishLevel)
  level!: EnglishLevel;

  @ApiProperty()
  @IsString()
  category!: string;

  @ApiPropertyOptional({ enum: CourseVisibility })
  @IsOptional()
  @IsEnum(CourseVisibility)
  visibility?: CourseVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  assignedTeacherIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  thumbnailMediaId?: string;
}

export class UpdateCourseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: EnglishLevel })
  @IsOptional()
  @IsEnum(EnglishLevel)
  level?: EnglishLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: CourseVisibility })
  @IsOptional()
  @IsEnum(CourseVisibility)
  visibility?: CourseVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  assignedTeacherIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  thumbnailMediaId?: string;
}
