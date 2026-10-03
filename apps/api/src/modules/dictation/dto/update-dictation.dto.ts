import { PartialType } from '@nestjs/mapped-types';
import { CreateDictationDto } from './create-dictation.dto.js';

export class UpdateDictationDto extends PartialType(CreateDictationDto) {}
