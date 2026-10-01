import { PartialType } from '@nestjs/mapped-types';
import { CreateExamDto } from './create-exam.dto.js';

export class UpdateExamDto extends PartialType(CreateExamDto) {}
