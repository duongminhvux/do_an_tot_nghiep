import { IsNumber,IsOptional,IsString,IsUUID } from 'class-validator';

export class UpdateLessonWordDto {
  @IsUUID('4')
  @IsOptional()
  sectionId?: string | null;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  customNote?: string;
}
