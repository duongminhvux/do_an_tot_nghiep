import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVocabularyFolderDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
