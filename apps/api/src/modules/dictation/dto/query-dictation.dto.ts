import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DictationLevel, DictationStatus } from '../schemas/dictation-lesson.schema.js';

import {PublicationFilterDto} from '../../publication/publication.dto.js';
export class QueryDictationDto extends PublicationFilterDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(DictationLevel)
  level?: DictationLevel;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsEnum(DictationStatus)
  status?: DictationStatus;
}
