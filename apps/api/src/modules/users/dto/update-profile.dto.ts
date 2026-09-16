import { IsOptional, IsString, IsUrl } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: i18nValidationMessage('auth.USERNAME_MUST_BE_STRING') })
  username?: string;

  @IsOptional()
  @IsUrl({}, { message: i18nValidationMessage('auth.AVATAR_URL_INVALID') })
  avatarUrl?: string;
}
