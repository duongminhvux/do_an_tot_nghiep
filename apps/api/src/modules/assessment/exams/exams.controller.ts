import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExamsService } from './exams.service.js';
import { QueryExamDto } from './dto/query-exam.dto.js';

@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  findAll(@Query() query: QueryExamDto) {
    return this.examsService.findAll({ ...query, isActive: true });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examsService.findOne(id);
  }
}
