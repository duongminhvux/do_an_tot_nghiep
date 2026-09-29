import { IsOptional, IsString } from 'class-validator';

export class UpdateSavedWordNoteDto {
  @IsOptional()
  @IsString()
  note?: string;
}
