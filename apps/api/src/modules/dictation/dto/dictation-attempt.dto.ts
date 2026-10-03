import { IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DictationAttemptDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  segmentIndex!: number;

  @IsBoolean()
  isCorrect!: boolean;
}
