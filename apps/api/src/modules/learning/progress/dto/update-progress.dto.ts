import { PartialType } from '@nestjs/mapped-types';
import { CreateProgressDto } from './create-progress.dto.js';

export class UpdateProgressDto extends PartialType(CreateProgressDto) {}
