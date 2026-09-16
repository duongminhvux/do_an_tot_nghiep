import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

export class ResendCodeDto {
    @IsEmail({}, { message: i18nValidationMessage('auth.EMAIL_INVALID') })
    @IsNotEmpty({ message: i18nValidationMessage('auth.EMAIL_REQUIRED') })
    @IsString({ message: i18nValidationMessage('auth.EMAIL_MUST_BE_STRING') })
    email!: string;
}