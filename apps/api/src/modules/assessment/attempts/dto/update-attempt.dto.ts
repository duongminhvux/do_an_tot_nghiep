import { PartialType } from '@nestjs/mapped-types';
import { CreateAttemptDto } from './create-attempt.dto.js';

export class UpdateAttemptDto extends PartialType(CreateAttemptDto) {}
