import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  Max,
  Min,
} from 'class-validator';
import { ExamMode } from '../attempt.types.js';

export class CreateAttemptDto {
  @IsMongoId()
  examId: string;

  @IsEnum(ExamMode)
  mode: ExamMode;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  selectedParts: number[];
}
