import { IsBoolean, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class RecordActionDto {
  @IsOptional()
  @IsMongoId()
  sessionId?: string;

  @IsOptional()
  @IsMongoId()
  lessonId?: string;

  @IsNotEmpty()
  @IsMongoId()
  wordId!: string;

  @IsOptional()
  @IsMongoId()
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
