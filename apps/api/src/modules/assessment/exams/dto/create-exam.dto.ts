import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export enum ExamType {
  TOEIC = 'TOEIC',
  IELTS = 'IELTS',
}

export enum ExamMode {
  PRACTICE = 'PRACTICE',
  FULL_TEST = 'FULL_TEST',
}

export enum ExamSection {
  LISTENING = 'LISTENING',
  READING = 'READING',
  FULL_TEST = 'FULL_TEST',
}

export class CreateExamDto {
  @IsNotEmpty({ message: i18nValidationMessage('exam.EXAM_NAME_REQUIRED') })
  @IsString({ message: i18nValidationMessage('exam.EXAM_NAME_MUST_BE_STRING') })
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsNotEmpty({ message: i18nValidationMessage('exam.EXAM_TYPE_REQUIRED') })
  @IsEnum(ExamType, { message: i18nValidationMessage('exam.EXAM_TYPE_INVALID') })
  type!: ExamType;

  @IsString({ message: i18nValidationMessage('exam.EXAM_DESCRIPTION_MUST_BE_STRING') })
  @IsOptional()
  description?: string;

  @IsInt({ message: i18nValidationMessage('exam.EXAM_DURATION_MUST_BE_INT') })
  @Min(0, { message: i18nValidationMessage('exam.EXAM_DURATION_MIN') })
  @IsOptional()
  durationMinutes?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  totalQuestions?: number;


  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt({ message: i18nValidationMessage('exam.EXAM_ORDER_MUST_BE_INT') })
  @Min(0, { message: i18nValidationMessage('exam.EXAM_ORDER_MIN') })
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  groupId?: string;
}
