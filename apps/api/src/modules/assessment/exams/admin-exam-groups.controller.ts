import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { ExamGroupsService } from './exam-groups.service.js';
import { CreateExamGroupDto } from './dto/create-exam-group.dto.js';
import { UpdateExamGroupDto } from './dto/update-exam-group.dto.js';
import { QueryExamGroupDto } from './dto/query-exam-group.dto.js';

@AdminController('exam-groups')
export class AdminExamGroupsController {
  constructor(private readonly examGroupsService: ExamGroupsService) {}

  @Post()
  create(@Body() dto: CreateExamGroupDto) {
    return this.examGroupsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryExamGroupDto) {
    return this.examGroupsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examGroupsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExamGroupDto,
  ) {
    return this.examGroupsService.update(id, dto);
  }

  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.examGroupsService.toggleActive(id, isActive);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.examGroupsService.remove(id);
  }

  @Get(':id/exams')
  getExams(@Param('id') id: string, @Query() query: any) {
    return this.examGroupsService.getExams(id, query);
  }

  @Post(':id/exams')
  addExams(
    @Param('id') id: string,
    @Body('examIds') examIds: string[],
  ) {
    return this.examGroupsService.addExams(id, examIds || []);
  }

  @Delete(':id/exams/:examId')
  removeExam(
    @Param('id') id: string,
    @Param('examId') examId: string,
  ) {
    return this.examGroupsService.removeExam(id, examId);
  }
}
