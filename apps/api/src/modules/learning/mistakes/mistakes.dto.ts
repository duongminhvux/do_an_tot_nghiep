import type { MistakeSource } from '@repo/shared-types/mistakes';
import { Type } from 'class-transformer';
import {
IsIn,
IsInt,
IsOptional,
IsString,
Max,
MaxLength,
Min,
} from 'class-validator';
export class MistakesQueryDto {
  @IsOptional()
  @IsIn(['TOEIC', 'DICTATION', 'VOCABULARY'])
  source?: MistakeSource;
  @IsOptional() @IsIn(['PENDING', 'REVIEWED']) status?: 'PENDING' | 'REVIEWED';
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
export class ReviewMistakeDto {
  // The count the learner actually saw; a concurrent new mistake stays pending.
  @IsInt() @Min(1) @Max(2147483647) seenWrongCount: number;
}
