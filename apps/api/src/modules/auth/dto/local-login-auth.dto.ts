import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class LocalLoginAuthDto {
    @IsNotEmpty({ message: i18nValidationMessage('auth.EMAIL_REQUIRED') })
    @IsString({ message: i18nValidationMessage('auth.EMAIL_MUST_BE_STRING') })
    @IsEmail({}, { message: i18nValidationMessage('auth.EMAIL_INVALID') })
    email!: string;

    @IsString({ message: i18nValidationMessage('auth.PASSWORD_MUST_BE_STRING') })
    @IsNotEmpty({ message: i18nValidationMessage('auth.PASSWORD_REQUIRED') })
    @MinLength(8, { message: i18nValidationMessage('auth.PASSWORD_MIN_LENGTH') })
    password!: string;
}
