import { Type } from 'class-transformer';
<<<<<<< HEAD
import { IsBoolean,IsInt,Min,IsOptional,IsString,MaxLength } from 'class-validator';
import { DictationEventDto } from './dictation-history.dto.js';
=======
import { IsBoolean,IsInt,Min,IsString,MaxLength } from 'class-validator';

export class DictationAnswerDto {
  @IsInt() @Min(0) segmentIndex:number;
  @IsString() @MaxLength(5000) answer:string;
}
>>>>>>> 5f669d0 (update Dictation)

export class DictationAttemptDto extends DictationEventDto {
  @IsOptional() @IsString() @MaxLength(2000) submittedText?:string;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  segmentIndex!: number;

  @IsBoolean()
  isCorrect!: boolean;
}
