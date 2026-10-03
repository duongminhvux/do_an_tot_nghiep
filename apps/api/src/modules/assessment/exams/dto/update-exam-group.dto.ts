import { PartialType } from '@nestjs/mapped-types';
import { CreateExamGroupDto } from './create-exam-group.dto.js';

export class UpdateExamGroupDto extends PartialType(CreateExamGroupDto) {}
