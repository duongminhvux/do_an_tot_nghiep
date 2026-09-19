import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class AdminLoginDto {
  @IsOptional()
  @IsString({ message: i18nValidationMessage('auth.EMAIL_MUST_BE_STRING') })
  email?: string;

  @IsOptional()
  @IsString({ message: i18nValidationMessage('auth.USERNAME_MUST_BE_STRING') })
  username?: string;

  @IsNotEmpty({ message: i18nValidationMessage('auth.PASSWORD_REQUIRED') })
  @IsString({ message: i18nValidationMessage('auth.PASSWORD_MUST_BE_STRING') })
  @MinLength(6, { message: i18nValidationMessage('auth.PASSWORD_MIN_LENGTH') })
  password!: string;
}
