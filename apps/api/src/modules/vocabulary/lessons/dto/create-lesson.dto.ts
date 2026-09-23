import { IsBoolean, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateLessonDto {
  @IsNotEmpty({ message: i18nValidationMessage('lesson.COLLECTION_ID_REQUIRED') })
  @IsMongoId({ message: i18nValidationMessage('lesson.COLLECTION_ID_INVALID') })
  collectionId!: string;

  @IsNotEmpty({ message: i18nValidationMessage('lesson.LESSON_TITLE_REQUIRED') })
  @IsString({ message: i18nValidationMessage('lesson.LESSON_TITLE_MUST_BE_STRING') })
  title!: string;

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
