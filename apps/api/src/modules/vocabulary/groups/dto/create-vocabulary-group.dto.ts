import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateVocabularyGroupDto {
  @IsNotEmpty({ message: i18nValidationMessage('vocabulary-group.GROUP_NAME_REQUIRED') })
  @IsString({ message: i18nValidationMessage('vocabulary-group.GROUP_NAME_MUST_BE_STRING') })
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
