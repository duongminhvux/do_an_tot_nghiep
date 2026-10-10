import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DictationSegmentActionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  segmentIndex!: number;
}
