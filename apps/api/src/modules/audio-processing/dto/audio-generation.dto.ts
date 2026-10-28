import { ArrayMaxSize,ArrayMinSize,IsArray,IsIn,IsOptional,IsString } from 'class-validator';

export class GenerateVocabularyAudioDto {
  @IsOptional()
  @IsIn(['us', 'uk', 'both'])
  accent: 'us' | 'uk' | 'both' = 'us';

  @IsOptional()
  @IsString()
  voiceId?: string;
}

export class BulkVocabularyAudioDto extends GenerateVocabularyAudioDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  ids!: string[];
}

export class GenerateToeicAudioDto {
  @IsOptional()
  @IsString()
  primaryVoiceId?: string;

  @IsOptional()
  @IsString()
  secondaryVoiceId?: string;
}

export class BulkToeicAudioDto {
  @IsOptional()
  @IsArray()
  parts?: number[];
}
