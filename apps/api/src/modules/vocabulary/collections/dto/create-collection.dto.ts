import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateCollectionDto {
  @IsNotEmpty({ message: i18nValidationMessage('collection.COLLECTION_NAME_REQUIRED') })
  @IsString({ message: i18nValidationMessage('collection.COLLECTION_NAME_MUST_BE_STRING') })
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  coverUrl?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
