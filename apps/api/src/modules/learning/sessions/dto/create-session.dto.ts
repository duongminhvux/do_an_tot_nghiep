import { IsDateString,IsEnum,IsNotEmpty,IsOptional,IsUUID } from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsEnum(['LESSON', 'REVIEW'])
  type?: 'LESSON' | 'REVIEW';

  @IsNotEmpty()
  @IsUUID('4')
  lessonId!: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;
}
