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
import { LessonsService } from './lessons.service.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { AddWordsToLessonDto } from './dto/add-words-to-lesson.dto.js';
import { CreateSectionDto } from './dto/create-section.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';
import { UpdateLessonWordDto } from './dto/update-lesson-word.dto.js';

@AdminController('lessons')
export class AdminLessonsController {
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

  @Patch('reorder')
  async reorderLessons(@Body('items') items: { id: string; order: number }[]) {
    await this.lessonsService.reorderLessons(items || []);
    return { success: true };
  }

  @Patch(':id')
  updateLesson(
    @Param('id') id: string,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    return this.lessonsService.updateLesson(id, updateLessonDto);
  }

  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.lessonsService.toggleActive(id, isActive);
  }

  @Delete(':id')
  removeLesson(@Param('id') id: string) {
    return this.lessonsService.removeLesson(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.lessonsService.restore(id);
  }

  // ==========================
  // Sections Management
  // ==========================
  @Post(':id/sections')
  createSection(
    @Param('id') id: string,
    @Body() createSectionDto: CreateSectionDto,
  ) {
    return this.lessonsService.createSection(id, createSectionDto);
  }

  @Get(':id/sections')
  getSections(@Param('id') id: string) {
    return this.lessonsService.getSections(id);
  }

  @Patch(':id/sections/reorder')
  async reorderSections(
    @Param('id') id: string,
    @Body('items') items: { id: string; order: number }[],
  ) {
    await this.lessonsService.reorderSections(id, items || []);
    return { success: true };
  }

  @Patch('sections/reorder')
  async reorderSectionsAlt(
    @Body('lessonId') lessonId: string,
    @Body('items') items: { id: string; order: number }[],
  ) {
    if (lessonId) {
      await this.lessonsService.reorderSections(lessonId, items || []);
    }
    return { success: true };
  }

  @Get('sections/:sectionId')
  getSectionById(@Param('sectionId') sectionId: string) {
    return this.lessonsService.getSectionById(sectionId);
  }

  @Patch('sections/:sectionId')
  updateSection(
    @Param('sectionId') sectionId: string,
    @Body() updateSectionDto: UpdateSectionDto,
  ) {
    return this.lessonsService.updateSection(sectionId, updateSectionDto);
  }

  @Patch(':id/sections/:sectionId')
  updateSectionWithLesson(
    @Param('sectionId') sectionId: string,
    @Body() updateSectionDto: UpdateSectionDto,
  ) {
    return this.lessonsService.updateSection(sectionId, updateSectionDto);
  }

  @Delete('sections/:sectionId')
  async deleteSection(@Param('sectionId') sectionId: string) {
    await this.lessonsService.deleteSection(sectionId);
    return { success: true };
  }

  @Delete(':id/sections/:sectionId')
  async deleteSectionWithLesson(@Param('sectionId') sectionId: string) {
    await this.lessonsService.deleteSection(sectionId);
    return { success: true };
  }

  // ==========================
  // Lesson Words Management
  // ==========================
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

  @Patch(':id/words/reorder')
  async reorderLessonWords(
    @Param('id') id: string,
    @Body('items') items: { wordId: string; order: number; sectionId?: string | null }[],
  ) {
    await this.lessonsService.reorderLessonWords(id, items || []);
    return { success: true };
  }

  @Patch(':id/words/:wordId')
  updateLessonWord(
    @Param('id') id: string,
    @Param('wordId') wordId: string,
    @Body() updateDto: UpdateLessonWordDto,
  ) {
    return this.lessonsService.updateLessonWord(id, wordId, updateDto);
  }

  @Delete(':id/words/:wordId')
  removeWordFromLesson(
    @Param('id') id: string,
    @Param('wordId') wordId: string,
  ) {
    return this.lessonsService.removeWordFromLesson(id, wordId);
  }
}
