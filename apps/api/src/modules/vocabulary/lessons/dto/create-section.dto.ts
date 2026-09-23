import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateSectionDto {
  @IsNotEmpty({ message: i18nValidationMessage('lesson.SECTION_NAME_REQUIRED') })
  @IsString({ message: i18nValidationMessage('lesson.SECTION_NAME_MUST_BE_STRING') })
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsNumber()
  @IsOptional()
  order?: number;
}
