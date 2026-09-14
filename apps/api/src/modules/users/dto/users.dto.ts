import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { EnglishLevel, UserStatus } from "../../../generated/prisma/client";

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @ApiPropertyOptional({ enum: EnglishLevel })
  @IsOptional()
  @IsEnum(EnglishLevel)
  targetLevel?: EnglishLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  learningGoal?: string;
}

export class UpdatePreferenceDto {
  @ApiProperty()
  @IsBoolean()
  emailNotifications!: boolean;

  @ApiProperty()
  @IsBoolean()
  learningReminder!: boolean;

  @ApiProperty()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  playbackSpeed!: number;

  @ApiProperty()
  @IsBoolean()
  reducedMotion!: boolean;
}

export class UpdateStudentStatusDto {
  @ApiProperty({ enum: [UserStatus.ACTIVE, UserStatus.BLOCKED] })
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class CreateTeacherDto {
  @ApiProperty()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  password!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTeacherDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
