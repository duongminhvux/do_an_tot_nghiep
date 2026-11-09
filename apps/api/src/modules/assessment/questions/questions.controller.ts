/// <reference types="multer" />
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator.js';
import {
Body,
Delete,
Get,
Param,
Patch,
Post,
Query,
UploadedFile,
UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';
import { QuestionsService } from './questions.service.js';

@AdminController('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @RequirePermissions('toeic.create')
  @Post()
  create(@Body() createQuestionDto: CreateQuestionDto) {
    return this.questionsService.create(createQuestionDto);
  }

  @RequirePermissions('toeic.import')
  @Post('exam/:examId/parse')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  parse(
    @Param('examId') examId: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.questionsService.parseQuestions(examId, body, file);
  }

  @RequirePermissions('toeic.import', 'toeic.create')
  @Post('exam/:examId/import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  import(
    @Param('examId') examId: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.questionsService.importQuestions(examId, body, file);
  }

  @RequirePermissions('toeic.read')
  @Get('exam/:examId')
  findByExam(
    @Param('examId') examId: string,
    @Query('part') part?: number,
  ) {
    return this.questionsService.findByExam(examId, part);
  }

  @RequirePermissions('toeic.read')
  @Get('exam/:examId/passages')
  findPassagesByExam(@Param('examId') examId: string) {
    return this.questionsService.findPassagesByExam(examId);
  }

  @RequirePermissions('toeic.read')
  @Get('exam/:examId/passage-groups')
  findPassageGroupsByExam(@Param('examId') examId: string) {
    return this.questionsService.findPassagesByExam(examId);
  }

  @RequirePermissions('toeic.create')
  @Post('passage-groups')
  createPassageGroup(@Body() body: any) {
    return this.questionsService.createPassageGroup(body);
  }

  @RequirePermissions('toeic.update')
  @Patch('passage-groups/:id')
  updatePassageGroup(@Param('id') id: string, @Body() body: any) {
    return this.questionsService.updatePassageGroup(id, body);
  }

  @RequirePermissions('toeic.delete')
  @Delete('passage-groups/:id')
  deletePassageGroup(@Param('id') id: string) {
    return this.questionsService.removePassageGroup(id);
  }

  @RequirePermissions('toeic.create')
  @Post('passages')
  createPassage(@Body() body: any) {
    return this.questionsService.createPassage(body);
  }

  @RequirePermissions('toeic.update')
  @Patch('passages/:id')
  updatePassage(@Param('id') id: string, @Body() body: any) {
    return this.questionsService.updatePassage(id, body);
  }

  @RequirePermissions('toeic.delete')
  @Delete('passages/:id')
  deletePassage(@Param('id') id: string) {
    return this.questionsService.removePassage(id);
  }

  @RequirePermissions('toeic.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @RequirePermissions('toeic.update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, updateQuestionDto);
  }

  @RequirePermissions('toeic.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }
}
