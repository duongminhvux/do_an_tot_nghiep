import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class GameAudioSettingsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  audioEnabled?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  @Matches(/^(?:$|https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/)
  backgroundMusicUrl?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  @Matches(/^(?:$|https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/)
  correctSoundUrl?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  @Matches(/^(?:$|https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/)
  wrongSoundUrl?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  @Matches(/^(?:$|https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/)
  loseSoundUrl?: string;
}
