import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ResetPasswordDto {
  @IsNotEmpty({ message: i18nValidationMessage('auth.EMAIL_REQUIRED') })
  @IsEmail({}, { message: i18nValidationMessage('auth.EMAIL_INVALID') })
  email!: string;

  @IsNotEmpty({ message: i18nValidationMessage('auth.CODE_REQUIRED') })
  @IsString({ message: i18nValidationMessage('auth.CODE_MUST_BE_STRING') })
  @Length(6, 6, { message: i18nValidationMessage('auth.CODE_INVALID_LENGTH') })
  code!: string;

  @IsNotEmpty({ message: i18nValidationMessage('auth.NEW_PASSWORD_REQUIRED') })
  @IsString({ message: i18nValidationMessage('auth.PASSWORD_MUST_BE_STRING') })
  @MinLength(8, { message: i18nValidationMessage('auth.PASSWORD_MIN_LENGTH') })
  newPassword!: string;
}
