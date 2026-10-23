import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  Min,
} from 'class-validator';

export class SaveAnswerDto {
  @IsMongoId()
  questionId: string;

  @IsIn(['A', 'B', 'C', 'D'])
  answer: string;
}

export class CheckAnswerDto {
  @IsMongoId()
  questionId: string;
}

export class AudioPlayDto {
  @IsMongoId()
  questionId: string;

  @IsOptional()
  @IsMongoId()
  passageId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  passageIndex?: number;
}

export class UpdateAttemptDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  flaggedQuestions?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  currentQuestionIndex?: number;
}
