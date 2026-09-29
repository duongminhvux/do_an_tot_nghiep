import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSavedWordDto {
  @IsNotEmpty()
  @IsMongoId()
  wordId: string;

  @IsOptional()
  @IsString()
  note?: string;
}
