import { IsArray, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class AddWordsToLessonDto {
  @IsArray({ message: i18nValidationMessage('lesson.WORD_IDS_INVALID') })
  @IsNotEmpty({ message: i18nValidationMessage('lesson.WORD_IDS_REQUIRED') })
  @IsMongoId({ each: true, message: i18nValidationMessage('lesson.WORD_IDS_INVALID') })
  wordIds!: string[];

  @IsMongoId()
  @IsOptional()
  sectionId?: string;
}

