import { IsDateString, IsEnum, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';

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
