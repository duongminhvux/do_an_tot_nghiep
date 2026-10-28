import { Type } from 'class-transformer';
import { IsBoolean,IsInt,Min } from 'class-validator';

export class DictationAttemptDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  segmentIndex!: number;

  @IsBoolean()
  isCorrect!: boolean;
}
