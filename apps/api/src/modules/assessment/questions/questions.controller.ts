/// <reference types="multer" />
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QuestionsService } from './questions.service.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';
import { UpdateQuestionDto } from './dto/update-question.dto.js';

@Controller('admin/questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  create(@Body() createQuestionDto: CreateQuestionDto) {
    return this.questionsService.create(createQuestionDto);
  }

  @Post('exam/:examId/parse')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  parse(
    @Param('examId') examId: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.questionsService.parseQuestions(examId, body, file);
  }

  @Post('exam/:examId/import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  import(
    @Param('examId') examId: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.questionsService.importQuestions(examId, body, file);
  }

  @Get('exam/:examId')
  findByExam(
    @Param('examId') examId: string,
    @Query('part') part?: number,
  ) {
    return this.questionsService.findByExam(examId, part);
  }

  @Get('exam/:examId/passages')
  findPassagesByExam(@Param('examId') examId: string) {
    return this.questionsService.findPassagesByExam(examId);
  }

  @Get('exam/:examId/passage-groups')
  findPassageGroupsByExam(@Param('examId') examId: string) {
    return this.questionsService.findPassagesByExam(examId);
  }

  @Post('passage-groups')
  createPassageGroup(@Body() body: any) {
    return this.questionsService.createPassageGroup(body);
  }

  @Patch('passage-groups/:id')
  updatePassageGroup(@Param('id') id: string, @Body() body: any) {
    return this.questionsService.updatePassageGroup(id, body);
  }

  @Delete('passage-groups/:id')
  deletePassageGroup(@Param('id') id: string) {
    return this.questionsService.removePassageGroup(id);
  }

  @Post('passages')
  createPassage(@Body() body: any) {
    return this.questionsService.createPassage(body);
  }

  @Patch('passages/:id')
  updatePassage(@Param('id') id: string, @Body() body: any) {
    return this.questionsService.updatePassage(id, body);
  }

  @Delete('passages/:id')
  deletePassage(@Param('id') id: string) {
    return this.questionsService.removePassage(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, updateQuestionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }
}
