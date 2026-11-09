import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
export class DictationEventDto {
  @IsOptional() @IsUUID('4') eventId?: string;
}
export class DictationHistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page: number =
    1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit: number =
    20;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsIn(['all', 'completed', 'in_progress']) status:
    'all' | 'completed' | 'in_progress' = 'all';
}
