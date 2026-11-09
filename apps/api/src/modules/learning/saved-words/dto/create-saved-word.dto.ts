import { IsNotEmpty,IsOptional,IsString,IsUUID,MaxLength } from 'class-validator';

export class CreatePersonalWordDto {
  @IsString() @IsNotEmpty() @MaxLength(100) word:string;
  @IsOptional() @IsString() @MaxLength(2000) note?:string;
  @IsOptional() @IsString() @MaxLength(200) ipa?:string;
  @IsOptional() @IsString() @MaxLength(2000) translation?:string;
}

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
