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
import { CreateVocabularyGroupDto } from './dto/create-vocabulary-group.dto.js';
import { QueryVocabularyGroupDto } from './dto/query-vocabulary-group.dto.js';
import { UpdateVocabularyGroupDto } from './dto/update-vocabulary-group.dto.js';
import { VocabularyGroupsService } from './vocabulary-groups.service.js';

@AdminController('vocabulary-groups')
export class AdminVocabularyGroupsController {
  constructor(private readonly vocabularyGroupsService: VocabularyGroupsService) {}

  @RequirePermissions('vocabulary.create')
  @Post()
  create(@Body() createVocabularyGroupDto: CreateVocabularyGroupDto) {
    return this.vocabularyGroupsService.create(createVocabularyGroupDto);
  }

  @RequirePermissions('vocabulary.read')
  @Get()
  findAll(@Query() query: QueryVocabularyGroupDto) {
    return this.vocabularyGroupsService.findAll(query);
  }

  @RequirePermissions('vocabulary.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vocabularyGroupsService.findOne(id);
  }

  @RequirePermissions('vocabulary.update')
  @Patch('reorder')
  async reorderGroups(@Body('items') items: { id: string; order: number }[]) {
    await this.vocabularyGroupsService.reorderGroups(items || []);
    return { success: true };
  }

  @RequirePermissions('vocabulary.update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVocabularyGroupDto: UpdateVocabularyGroupDto,
  ) {
    return this.vocabularyGroupsService.update(id, updateVocabularyGroupDto);
  }

  @RequirePermissions('vocabulary.update')
  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.vocabularyGroupsService.toggleActive(id, isActive);
  }

  @RequirePermissions('vocabulary.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vocabularyGroupsService.remove(id);
  }

  @RequirePermissions('vocabulary.restore')
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.vocabularyGroupsService.restore(id);
  }
}
