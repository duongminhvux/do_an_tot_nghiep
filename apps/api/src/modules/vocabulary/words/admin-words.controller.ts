import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator.js';
import {
Body,
Delete,
Get,
Param,
Patch,
Post,
Query
} from '@nestjs/common';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { CreateWordDto } from './dto/create-word.dto.js';
import { QueryWordDto } from './dto/query-word.dto.js';
import { UpdateWordDto } from './dto/update-word.dto.js';
import { WordsService } from './words.service.js';

@AdminController('words')
export class AdminWordsController {
  constructor(private readonly wordsService: WordsService) {}

  @RequirePermissions('vocabulary.create')
  @Post()
  create(@Body() createWordDto: CreateWordDto) {
    return this.wordsService.create(createWordDto);
  }

  @RequirePermissions('vocabulary.read')
  @Get()
  findAll(@Query() query: QueryWordDto) {
    return this.wordsService.findAll(query);
  }

  @RequirePermissions('vocabulary.read')
  @Post('bulk-lookup')
  bulkLookup(@Body('words') words: string[]) {
    return this.wordsService.bulkLookup(words);
  }

  @RequirePermissions('vocabulary.update')
  @Patch('bulk-active')
  bulkToggleActive(
    @Body('ids') ids: string[],
    @Body('isActive') isActive: boolean,
  ) {
    return this.wordsService.bulkToggleActive(ids, isActive);
  }

  @RequirePermissions('vocabulary.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.wordsService.findOne(id);
  }

  @RequirePermissions('vocabulary.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWordDto: UpdateWordDto) {
    return this.wordsService.update(id, updateWordDto);
  }

  @RequirePermissions('vocabulary.update')
  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.wordsService.toggleActive(id, isActive);
  }

  @RequirePermissions('vocabulary.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.wordsService.remove(id);
  }

  @RequirePermissions('vocabulary.restore')
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.wordsService.restore(id);
  }
}
