import { IsDefined, IsInt, Max, Min } from 'class-validator';

export class ExamTimingDto {
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(1440)
  testDurationMinutes!: number;

  @IsDefined()
  @IsInt()
  @Min(0)
  @Max(1440)
  practiceDurationMinutes!: number;
}
