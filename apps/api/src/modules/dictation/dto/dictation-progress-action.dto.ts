import { Type } from 'class-transformer';
import { IsInt,Min } from 'class-validator';

export class DictationSegmentActionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  segmentIndex!: number;
}
