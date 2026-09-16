import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class VerifyEmailDto {
  @IsNotEmpty({ message: i18nValidationMessage('auth.EMAIL_REQUIRED') })
  @IsEmail({}, { message: i18nValidationMessage('auth.EMAIL_INVALID') })
  email!: string;

  @IsNotEmpty({ message: i18nValidationMessage('auth.CODE_REQUIRED') })
  @IsString({ message: i18nValidationMessage('auth.CODE_MUST_BE_STRING') })
  @Length(6, 6, { message: i18nValidationMessage('auth.CODE_INVALID_LENGTH') })
  code!: string;
}
