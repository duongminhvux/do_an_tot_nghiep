import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsObject, ValidateIf, ValidateNested } from 'class-validator';
import { CreateExamDto } from './create-exam.dto.js';
import { ExamTimingDto } from './exam-timing.dto.js';

export class UpdateExamDto extends PartialType(CreateExamDto) {
  @ValidateIf((_object,value)=>value!==undefined)
  @IsObject()
  @ValidateNested()
  @Type(()=>ExamTimingDto)
  timingSettings?: ExamTimingDto;
}
