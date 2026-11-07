import { Type } from 'class-transformer';
import { IsBoolean,IsInt,Min,IsOptional,IsString,MaxLength } from 'class-validator';
import { DictationEventDto } from './dictation-history.dto.js';

export class DictationAttemptDto extends DictationEventDto {
  @IsOptional() @IsString() @MaxLength(2000) submittedText?:string;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  segmentIndex!: number;

  @IsBoolean()
  isCorrect!: boolean;
}
