import { IsBoolean, IsDateString, IsEnum, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';

export class RecordActionDto {
  @IsOptional()
  @IsUUID('4')
  sessionId?: string;

  @IsOptional()
  @IsUUID('4')
  lessonId?: string;

  @IsNotEmpty()
  @IsUUID('4')
  wordId!: string;

  @IsOptional()
  @IsUUID('4')
  lessonWordId?: string;

  @IsOptional()
  @IsDateString()
  sessionStartedAt?: string;

  @IsNotEmpty()
  @IsEnum(['FLASHCARD', 'MULTIPLE_CHOICE', 'TYPING'])
  mode!: 'FLASHCARD' | 'MULTIPLE_CHOICE' | 'TYPING';

  @IsOptional()
  @IsEnum(['AGAIN', 'HARD', 'GOOD', 'EASY'])
  rating?: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;

  @IsOptional()
  @IsDateString()
  answeredAt?: string;
}
