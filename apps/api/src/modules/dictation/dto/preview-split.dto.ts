import { IsString, MaxLength, MinLength } from 'class-validator';

export class PreviewSplitDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50_000)
  sourceText!: string;
}
