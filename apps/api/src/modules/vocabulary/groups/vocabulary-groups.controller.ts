import { Controller, Get, Param, Query } from '@nestjs/common';
import { VocabularyGroupsService } from './vocabulary-groups.service.js';
import { QueryVocabularyGroupDto } from './dto/query-vocabulary-group.dto.js';

@Controller('vocabulary-groups')
export class VocabularyGroupsController {
  constructor(private readonly vocabularyGroupsService: VocabularyGroupsService) {}

  @Get()
  findAll(@Query() query: QueryVocabularyGroupDto) {
    return this.vocabularyGroupsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vocabularyGroupsService.findOne(id);
  }
}
