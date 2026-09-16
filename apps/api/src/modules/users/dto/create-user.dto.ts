import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MinLength, ValidateIf } from 'class-validator';
import { AuthProvider } from '../schema/user.schema.js';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateUserDto {
	@IsNotEmpty({ message: i18nValidationMessage('auth.EMAIL_REQUIRED') })
	@IsEmail({}, { message: i18nValidationMessage('auth.EMAIL_INVALID') })
	email!: string;

	@IsNotEmpty({ message: i18nValidationMessage('auth.USERNAME_REQUIRED') })
	@IsString({ message: i18nValidationMessage('auth.USERNAME_MUST_BE_STRING') })
	username!: string;

	@ValidateIf((dto) => dto.authProvider !== AuthProvider.GOOGLE)
	@IsNotEmpty({ message: i18nValidationMessage('auth.PASSWORD_REQUIRED') })
	@IsString({ message: i18nValidationMessage('auth.PASSWORD_MUST_BE_STRING') })
	@MinLength(8, { message: i18nValidationMessage('auth.PASSWORD_MIN_LENGTH') })
	password?: string;

	@IsOptional()
	@IsUrl({}, { message: i18nValidationMessage('auth.AVATAR_URL_INVALID') })
	avatarUrl?: string;

	@IsOptional()
	@IsEnum(AuthProvider, { message: i18nValidationMessage('auth.AUTH_PROVIDER_INVALID') })
	authProvider?: AuthProvider;

	@ValidateIf((dto) => dto.authProvider === AuthProvider.GOOGLE)
	@IsNotEmpty({ message: i18nValidationMessage('auth.GG_ID_REQUIRED') })
	@IsString({ message: i18nValidationMessage('auth.GG_ID_MUST_BE_STRING') })
	ggId?: string;

	@IsOptional()
	@IsString()
	code?: string;

	@IsOptional()
	codeExpiresAt?: Date;
}
