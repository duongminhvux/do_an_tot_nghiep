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
import { VocabularyGroupsService } from './vocabulary-groups.service.js';
import { CreateVocabularyGroupDto } from './dto/create-vocabulary-group.dto.js';
import { UpdateVocabularyGroupDto } from './dto/update-vocabulary-group.dto.js';
import { QueryVocabularyGroupDto } from './dto/query-vocabulary-group.dto.js';

@AdminController('vocabulary-groups')
export class AdminVocabularyGroupsController {
  constructor(private readonly vocabularyGroupsService: VocabularyGroupsService) {}

  @Post()
  create(@Body() createVocabularyGroupDto: CreateVocabularyGroupDto) {
    return this.vocabularyGroupsService.create(createVocabularyGroupDto);
  }

  @Get()
  findAll(@Query() query: QueryVocabularyGroupDto) {
    return this.vocabularyGroupsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vocabularyGroupsService.findOne(id);
  }

  @Patch('reorder')
  async reorderGroups(@Body('items') items: { id: string; order: number }[]) {
    await this.vocabularyGroupsService.reorderGroups(items || []);
    return { success: true };
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVocabularyGroupDto: UpdateVocabularyGroupDto,
  ) {
    return this.vocabularyGroupsService.update(id, updateVocabularyGroupDto);
  }

  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.vocabularyGroupsService.toggleActive(id, isActive);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vocabularyGroupsService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.vocabularyGroupsService.restore(id);
  }
}
