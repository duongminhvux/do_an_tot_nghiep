import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from "class-validator";
import { AuthClientType, EnglishLevel } from "../../../generated/prisma/client";

export class RegisterDto {
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

  @ApiPropertyOptional({ enum: EnglishLevel })
  @IsOptional()
  @IsEnum(EnglishLevel)
  targetLevel?: EnglishLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  learningGoal?: string;
}

export class LoginDto {
  @ApiProperty()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;

  @ApiProperty({ enum: AuthClientType })
  @IsEnum(AuthClientType)
  clientType!: AuthClientType;
}

export class RefreshDto {
  @ApiProperty({ enum: AuthClientType })
  @IsEnum(AuthClientType)
  clientType!: AuthClientType;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  newPassword!: string;
}
