import { IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateLessonWordDto {
  @IsMongoId()
  @IsOptional()
  sectionId?: string | null;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  customNote?: string;
}
