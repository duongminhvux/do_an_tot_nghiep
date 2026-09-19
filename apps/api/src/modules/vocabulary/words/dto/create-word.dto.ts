import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum WordLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export class WordIpaDto {
  @IsString()
  @IsOptional()
  us?: string;

  @IsString()
  @IsOptional()
  uk?: string;
}

export class WordAudioDto {
  @IsString()
  @IsOptional()
  us?: string;

  @IsString()
  @IsOptional()
  uk?: string;
}

export class WordExampleDto {
  @IsString()
  @IsNotEmpty()
  en!: string;

  @IsString()
  @IsNotEmpty()
  vi!: string;
}

export class WordMeaningDto {
  @IsString()
  @IsNotEmpty()
  definition!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  translation?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  synonyms?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  antonyms?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordExampleDto)
  @IsOptional()
  examples?: WordExampleDto[];
}

export class WordPartDto {
  @IsString()
  @IsNotEmpty()
  partOfSpeech!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordMeaningDto)
  @IsOptional()
  meanings?: WordMeaningDto[];
}

export class CreateWordDto {
  @IsString()
  @IsNotEmpty()
  word!: string;

  @IsEnum(WordLevel)
  @IsNotEmpty()
  level!: WordLevel;

  @ValidateNested()
  @Type(() => WordIpaDto)
  @IsOptional()
  ipa?: WordIpaDto;

  @ValidateNested()
  @Type(() => WordAudioDto)
  @IsOptional()
  audio?: WordAudioDto;

  @IsString()
  @IsOptional()
  image?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variations?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  relatedWords?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordPartDto)
  @IsOptional()
  parts?: WordPartDto[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean;
}
