import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExamGroupsService } from './exam-groups.service.js';
import { QueryExamGroupDto } from './dto/query-exam-group.dto.js';

@Controller('exam-groups')
export class ExamGroupsController {
  constructor(private readonly examGroupsService: ExamGroupsService) {}

  @Get()
  findAll(@Query() query: QueryExamGroupDto) {
    return this.examGroupsService.findAll({ ...query, isActive: true });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examGroupsService.findOne(id);
  }

  @Get(':id/exams')
  getExams(@Param('id') id: string, @Query() query: any) {
    return this.examGroupsService.getExams(id, query);
  }
}
