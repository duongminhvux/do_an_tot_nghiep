import { Body,Controller,Delete,Get,Param,Patch,Post,Query,UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { AddWordsToLessonDto } from './dto/add-words-to-lesson.dto.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { LessonsService } from './lessons.service.js';

@Controller('lessons')
@UseGuards(RolesGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Roles('ADMIN')
  @Post()
  createLesson(@Body() createLessonDto: CreateLessonDto) {
    return this.lessonsService.createLesson(createLessonDto);
  }

  @Get()
  findAllLessons(@Query('collectionId') collectionId?: string) {
    return this.lessonsService.findAllLessons(collectionId);
  }

  @Get('slug/:slug')
  findBySlug(
    @Param('slug') slug: string,
    @Query('collectionId') collectionId?: string,
  ) {
    return this.lessonsService.findBySlug(slug, collectionId);
  }

  @Get(':id')
  findOneLesson(@Param('id') id: string) {
    return this.lessonsService.findOneLesson(id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  updateLesson(@Param('id') id: string, @Body() updateLessonDto: UpdateLessonDto) {
    return this.lessonsService.updateLesson(id, updateLessonDto);
  }

  @Roles('ADMIN')
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
  @Roles('ADMIN')
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

  @Roles('ADMIN')
  @Delete(':id/words/:wordId')
  removeWordFromLesson(
    @Param('id') id: string,
    @Param('wordId') wordId: string,
  ) {
    return this.lessonsService.removeWordFromLesson(id, wordId);
  }
}
