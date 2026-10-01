import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionOptionDto } from './create-question.dto.js';

export class ImportPassageDto {
  @IsString()
  @IsOptional()
  tempId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsEnum(['TEXT', 'EMAIL', 'ADVERTISEMENT', 'ARTICLE', 'NOTICE', 'CHAT'])
  @IsOptional()
  type?: 'TEXT' | 'EMAIL' | 'ADVERTISEMENT' | 'ARTICLE' | 'NOTICE' | 'CHAT';

  @IsNumber()
  @IsOptional()
  order?: number;
}

export class ImportSingleQuestionDto {
  @IsString()
  content: string;

  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];

  @IsEnum(['A', 'B', 'C', 'D'])
  @IsNotEmpty()
  correctAnswer: 'A' | 'B' | 'C' | 'D';

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  passageGroupId?: string;

  @IsString()
  @IsOptional()
  passageId?: string;

  @IsString()
  @IsOptional()
  passageTempId?: string;

  @IsString()
  @IsOptional()
  passageTitle?: string;
}

export class ImportQuestionsDto {
  @IsEnum(['LISTENING', 'READING'])
  @IsOptional()
  section?: 'LISTENING' | 'READING';

  @IsNumber()
  @IsOptional()
  part?: number;

  @ValidateNested()
  @Type(() => ImportPassageDto)
  @IsOptional()
  passage?: ImportPassageDto;

  @ValidateNested({ each: true })
  @Type(() => ImportPassageDto)
  @IsOptional()
  passages?: ImportPassageDto[];

  @ValidateNested({ each: true })
  @Type(() => ImportSingleQuestionDto)
  @IsOptional()
  questions?: ImportSingleQuestionDto[];

  @IsString()
  @IsOptional()
  rawText?: string;
}
