import { PartialType } from '@nestjs/mapped-types';
import { CreateVocabularyGroupDto } from './create-vocabulary-group.dto.js';

export class UpdateVocabularyGroupDto extends PartialType(CreateVocabularyGroupDto) {}
