import { IsNotEmpty,IsOptional,IsString,IsUUID } from 'class-validator';

export class CreateSavedWordDto {
  @IsNotEmpty()
  @IsUUID('4')
  wordId: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsUUID('4')
  folderId?: string;
}
