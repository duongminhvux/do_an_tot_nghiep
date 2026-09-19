import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ChangePasswordDto {
  @IsNotEmpty({ message: i18nValidationMessage('auth.OLD_PASSWORD_REQUIRED') })
  @IsString({ message: i18nValidationMessage('auth.PASSWORD_MUST_BE_STRING') })
  oldPassword!: string;

  @IsNotEmpty({ message: i18nValidationMessage('auth.NEW_PASSWORD_REQUIRED') })
  @IsString({ message: i18nValidationMessage('auth.PASSWORD_MUST_BE_STRING') })
  @MinLength(6, { message: i18nValidationMessage('auth.PASSWORD_MIN_LENGTH') })
  newPassword!: string;
}
