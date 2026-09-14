import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";

export class LandingSectionInputDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  orderIndex!: number;

  @IsObject()
  draftContent!: Record<string, string>;
}

export class SaveLandingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LandingSectionInputDto)
  sections!: LandingSectionInputDto[];
}

export class UpdateSiteSettingsDto {
  @IsOptional() @IsString() siteName?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() footerText?: string;
  @IsOptional() @IsString() logoMediaId?: string;
  @IsOptional() @IsString() faviconMediaId?: string;
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
}
