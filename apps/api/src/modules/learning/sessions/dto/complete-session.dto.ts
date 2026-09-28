import { IsDateString, IsOptional } from 'class-validator';

export class CompleteSessionDto {
  @IsOptional()
  @IsDateString()
  endedAt?: string;
}
