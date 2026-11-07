import { Type } from 'class-transformer';
import { IsInt,Min } from 'class-validator';
import { DictationEventDto } from './dictation-history.dto.js';

export class DictationSegmentActionDto extends DictationEventDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  segmentIndex!: number;
}
