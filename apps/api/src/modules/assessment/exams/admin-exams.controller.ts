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
import { ExamsService } from './exams.service.js';
import { CreateExamDto } from './dto/create-exam.dto.js';
import { UpdateExamDto } from './dto/update-exam.dto.js';
import { QueryExamDto } from './dto/query-exam.dto.js';

@AdminController('exams')
export class AdminExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  create(@Body() createExamDto: CreateExamDto) {
    return this.examsService.create(createExamDto);
  }

  @Get()
  findAll(@Query() query: QueryExamDto) {
    return this.examsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examsService.findOne(id);
  }

  @Patch('reorder')
  async reorderExams(@Body('items') items: { id: string; order: number }[]) {
    await this.examsService.reorderExams(items || []);
    return { success: true };
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateExamDto: UpdateExamDto,
  ) {
    return this.examsService.update(id, updateExamDto);
  }

  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body() body: UpdateExamDto,
  ) {
    return this.examsService.toggleActive(id, body.isActive);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.examsService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.examsService.restore(id);
  }
}
