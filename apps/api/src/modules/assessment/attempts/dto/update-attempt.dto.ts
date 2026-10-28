import {
ArrayUnique,
IsArray,
IsIn,
IsInt,
IsOptional,
IsUUID,
Min
} from 'class-validator';

export class SaveAnswerDto {
  @IsUUID('4')
  questionId: string;

  @IsIn(['A', 'B', 'C', 'D'])
  answer: string;
}

export class CheckAnswerDto {
  @IsUUID('4')
  questionId: string;
}

export class AudioPlayDto {
  @IsUUID('4')
  questionId: string;

  @IsOptional()
  @IsUUID('4')
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
  @IsUUID('4',{ each: true })
  flaggedQuestions?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  currentQuestionIndex?: number;
}
