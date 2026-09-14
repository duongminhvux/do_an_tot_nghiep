import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class UpdateTtsSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @IsOptional()
  @IsString()
  defaultVoiceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  defaultSpeed?: number;
}

export class GenerateAudioDto {
  @IsOptional()
  @IsIn(["EXERCISE", "GROUP", "SEGMENT"])
  targetType?: "EXERCISE" | "GROUP" | "SEGMENT";

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  audioSegmentId?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speed?: number;
}
