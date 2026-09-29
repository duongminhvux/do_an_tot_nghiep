import { IsOptional, IsString } from 'class-validator';

export class QuerySavedWordsDto {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'savedAt' | 'alpha';

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}
