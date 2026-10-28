import { Transform,Type } from 'class-transformer';
import { IsBoolean,IsNumber,IsOptional,IsString,Min } from 'class-validator';

export class QueryCollectionDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  groupId?: string;

  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
