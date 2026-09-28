import { IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsEnum(['LESSON', 'REVIEW'])
  type?: 'LESSON' | 'REVIEW';

  @IsNotEmpty()
  @IsMongoId()
  lessonId!: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;
}
