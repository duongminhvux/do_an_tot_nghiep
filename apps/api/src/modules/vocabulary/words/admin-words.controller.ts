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
import { CreateWordDto } from './dto/create-word.dto.js';
import { UpdateWordDto } from './dto/update-word.dto.js';
import { QueryWordDto } from './dto/query-word.dto.js';
import { WordsService } from './words.service.js';

@AdminController('words')
export class AdminWordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Post()
  create(@Body() createWordDto: CreateWordDto) {
    return this.wordsService.create(createWordDto);
  }

  @Get()
  findAll(@Query() query: QueryWordDto) {
    return this.wordsService.findAll(query);
  }

  @Post('bulk-lookup')
  bulkLookup(@Body('words') words: string[]) {
    return this.wordsService.bulkLookup(words);
  }

  @Patch('bulk-active')
  bulkToggleActive(
    @Body('ids') ids: string[],
    @Body('isActive') isActive: boolean,
  ) {
    return this.wordsService.bulkToggleActive(ids, isActive);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.wordsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWordDto: UpdateWordDto) {
    return this.wordsService.update(id, updateWordDto);
  }

  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.wordsService.toggleActive(id, isActive);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.wordsService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.wordsService.restore(id);
  }
}
