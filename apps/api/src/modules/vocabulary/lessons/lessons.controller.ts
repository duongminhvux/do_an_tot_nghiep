import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { LessonsService } from './lessons.service.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { AddWordsToLessonDto } from './dto/add-words-to-lesson.dto.js';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  createLesson(@Body() createLessonDto: CreateLessonDto) {
    return this.lessonsService.createLesson(createLessonDto);
  }

  @Get()
  findAllLessons(@Query('collectionId') collectionId?: string) {
    return this.lessonsService.findAllLessons(collectionId);
  }

  @Get(':id')
  findOneLesson(@Param('id') id: string) {
    return this.lessonsService.findOneLesson(id);
  }

  @Patch(':id')
  updateLesson(@Param('id') id: string, @Body() updateLessonDto: UpdateLessonDto) {
    return this.lessonsService.updateLesson(id, updateLessonDto);
  }

  @Delete(':id')
  removeLesson(@Param('id') id: string) {
    return this.lessonsService.removeLesson(id);
  }

  // Sections
  @Get(':id/sections')
  getSections(@Param('id') id: string) {
    return this.lessonsService.getSections(id);
  }

  // Lesson Words Management
  @Post(':id/words')
  addWordsToLesson(
    @Param('id') id: string,
    @Body() addWordsDto: AddWordsToLessonDto,
  ) {
    return this.lessonsService.addWordsToLesson(
      id,
      addWordsDto.wordIds,
      addWordsDto.sectionId,
    );
  }

  @Get(':id/words')
  getWordsInLesson(
    @Param('id') id: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.lessonsService.getWordsInLesson(id, sectionId);
  }

  @Delete(':id/words/:wordId')
  removeWordFromLesson(
    @Param('id') id: string,
    @Param('wordId') wordId: string,
  ) {
    return this.lessonsService.removeWordFromLesson(id, wordId);
  }
}
