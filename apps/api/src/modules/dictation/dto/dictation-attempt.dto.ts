import { Type } from 'class-transformer';
import { IsBoolean,IsInt,Min,IsOptional,IsString,MaxLength } from 'class-validator';
import { DictationEventDto } from './dictation-history.dto.js';

export class DictationAnswerDto extends DictationEventDto {
  @Type(() => Number) @IsInt() @Min(0) segmentIndex!:number;
  @IsString() @MaxLength(5000) answer!:string;
}

export class DictationAttemptDto extends DictationEventDto {
  @IsOptional() @IsString() @MaxLength(2000) submittedText?:string;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  segmentIndex!: number;

  @IsBoolean()
  isCorrect!: boolean;
}
