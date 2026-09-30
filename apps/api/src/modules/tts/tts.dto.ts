import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SynthesizeTtsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  text!: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsIn(['en-US', 'en-GB'])
  language: 'en-US' | 'en-GB' = 'en-US';

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speed: number = 1;
}

export class TtsSequenceSegmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  text: string = '';

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsIn(['en-US', 'en-GB'])
  language?: 'en-US' | 'en-GB';

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  speed?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  pauseAfterMs: number = 0;
}

export class SynthesizeSequenceTtsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TtsSequenceSegmentDto)
  segments!: TtsSequenceSegmentDto[];

  @IsOptional()
  @IsString()
  defaultVoiceId: string = 'af_heart';

  @IsOptional()
  @IsIn(['en-US', 'en-GB'])
  defaultLanguage: 'en-US' | 'en-GB' = 'en-US';

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  defaultSpeed: number = 1;
}
