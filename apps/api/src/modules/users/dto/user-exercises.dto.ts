import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
export const EXERCISE_OWNERS = {
  toeic: 'assessment',
  vocabulary: 'learning',
  dictation: 'content',
  arena: 'arena',
  minigame: 'learning',
} as const;
export type ExerciseModule = keyof typeof EXERCISE_OWNERS;
export class UserExercisesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
  @IsOptional() @IsIn(['all', 'completed', 'unfinished']) status:
    'all' | 'completed' | 'unfinished' = 'all';
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
export class UserExercisesReadDto extends UserExercisesQueryDto {
  @IsUUID() userId!: string;
  @IsIn(Object.keys(EXERCISE_OWNERS)) module!: ExerciseModule;
  @IsOptional() @IsUUID() recordId?: string;
}
