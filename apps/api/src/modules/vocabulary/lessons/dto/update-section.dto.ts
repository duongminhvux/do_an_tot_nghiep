import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateSectionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsNumber()
  @IsOptional()
  order?: number;
}
