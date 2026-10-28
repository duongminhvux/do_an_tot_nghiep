import { IsArray,IsNotEmpty,IsOptional,IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class AddWordsToLessonDto {
  @IsArray({ message: i18nValidationMessage('lesson.WORD_IDS_INVALID') })
  @IsNotEmpty({ message: i18nValidationMessage('lesson.WORD_IDS_REQUIRED') })
  @IsUUID('4', { each: true, message: i18nValidationMessage('lesson.WORD_IDS_INVALID') })
  wordIds!: string[];

  @IsUUID('4')
  @IsOptional()
  sectionId?: string;
}

