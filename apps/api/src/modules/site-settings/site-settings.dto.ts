import { Transform } from 'class-transformer';
import {
IsNotEmpty,
IsString,
IsTimeZone,
Matches,
MaxLength,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class UpdateSiteSettingsDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) siteName: string;
  @Transform(trim) @IsString() @MaxLength(300) siteDescription: string;
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @Matches(/^(?:$|https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/)
  logoUrl: string;
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @Matches(/^(?:$|https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/)
  iconUrl: string;
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @Matches(/^(?:$|https?:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/)
  faviconUrl: string;
  @Transform(trim) @IsTimeZone() timezone: string;
}
