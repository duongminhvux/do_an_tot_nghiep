import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator.js';
import { Body,Delete,Get,Param,Patch,Post,Query } from '@nestjs/common';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { CreateExamGroupDto } from './dto/create-exam-group.dto.js';
import { QueryExamGroupDto } from './dto/query-exam-group.dto.js';
import { ReorderGroupExamsDto } from './dto/reorder-group-exams.dto.js';
import { UpdateExamGroupDto } from './dto/update-exam-group.dto.js';
import { ExamGroupsService } from './exam-groups.service.js';

@AdminController('exam-groups')
export class AdminExamGroupsController {
  constructor(private readonly examGroupsService: ExamGroupsService) {}

  @RequirePermissions('toeic.create')
  @Post()
  create(@Body() dto: CreateExamGroupDto) {
    return this.examGroupsService.create(dto);
  }

  @RequirePermissions('toeic.read')
  @Get()
  findAll(@Query() query: QueryExamGroupDto) {
    return this.examGroupsService.findAll(query);
  }

  @RequirePermissions('toeic.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examGroupsService.findOne(id);
  }

  @RequirePermissions('toeic.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExamGroupDto) {
    return this.examGroupsService.update(id, dto);
  }

  @RequirePermissions('toeic.update')
  @Patch(':id/active')
  toggleActive(@Param('id') id: string, @Body('isActive') isActive?: boolean) {
    return this.examGroupsService.toggleActive(id, isActive);
  }

  @RequirePermissions('toeic.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.examGroupsService.remove(id);
  }

  @RequirePermissions('toeic.read')
  @Get(':id/exams')
  getExams(@Param('id') id: string, @Query() query: any) {
    return this.examGroupsService.getExams(id, query);
  }

  @RequirePermissions('toeic.update')
  @Post(':id/exams')
  addExams(@Param('id') id: string, @Body('examIds') examIds: string[]) {
    return this.examGroupsService.addExams(id, examIds || []);
  }

  @RequirePermissions('toeic.update')
  @Patch(':id/exams/order')
  reorderExams(@Param('id') id: string, @Body() dto: ReorderGroupExamsDto) {
    return this.examGroupsService.reorderExams(id, dto.examIds);
  }

  @RequirePermissions('toeic.update')
  @Delete(':id/exams/:examId')
  removeExam(@Param('id') id: string, @Param('examId') examId: string) {
    return this.examGroupsService.removeExam(id, examId);
  }
}
