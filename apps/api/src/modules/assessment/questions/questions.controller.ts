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
import { ImportQuestionsDto } from './dto/import-questions.dto.js';

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

  @Post('passages')
  createPassage(@Body() body: any) {
    return this.questionsService.createPassage(body);
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

