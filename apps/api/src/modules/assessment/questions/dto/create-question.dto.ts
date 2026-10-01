import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class QuestionOptionDto {
  @IsEnum(['A', 'B', 'C', 'D'])
  @IsNotEmpty()
  key: 'A' | 'B' | 'C' | 'D';

  @IsString()
  @IsNotEmpty()
  text: string;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  examId: string;

  @IsString()
  @IsOptional()
  passageGroupId?: string;

  @IsString()
  @IsOptional()
  passageId?: string;

  @IsEnum(['LISTENING', 'READING'])
  @IsNotEmpty()
  section: 'LISTENING' | 'READING';

  @IsNumber()
  @IsNotEmpty()
  part: number;

  @IsString()
  @IsNotEmpty()
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

  @IsEnum(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
