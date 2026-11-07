import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator.js';
import { Body,Delete,Get,Param,Patch,Post,Query,Req } from '@nestjs/common';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { CreateExamDto } from './dto/create-exam.dto.js';
import { QueryExamDto } from './dto/query-exam.dto.js';
import { UpdateExamDto } from './dto/update-exam.dto.js';
import { ExamsService } from './exams.service.js';

@AdminController('exams')
export class AdminExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @RequirePermissions('toeic.create')
  @Post()
  create(@Body() createExamDto: CreateExamDto, @Req() request: { user: { _id: string } }) {
    return this.examsService.createWithVisibility(createExamDto, String(request.user._id));
  }

  @RequirePermissions('toeic.read')
  @Get()
  findAll(@Query() query: QueryExamDto) {
    return this.examsService.findAll(query);
  }

  @RequirePermissions('toeic.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examsService.findOne(id);
  }

  @RequirePermissions('toeic.update')
  @Patch('reorder')
  async reorderExams(@Body('items') items: { id: string; order: number }[]) {
    await this.examsService.reorderExams(items || []);
    return { success: true };
  }

  @RequirePermissions('toeic.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateExamDto: UpdateExamDto) {
    return this.examsService.update(id, updateExamDto);
  }

  @RequirePermissions('toeic.update')
  @Patch(':id/active')
  toggleActive(@Param('id') id: string, @Body() body: UpdateExamDto) {
    return this.examsService.toggleActive(id, body.isActive);
  }

  @RequirePermissions('toeic.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.examsService.remove(id);
  }

  @RequirePermissions('toeic.restore')
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.examsService.restore(id);
  }
}
