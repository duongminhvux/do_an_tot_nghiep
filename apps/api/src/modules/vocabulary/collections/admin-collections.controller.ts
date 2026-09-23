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
import { CollectionsService } from './collections.service.js';
import { CreateCollectionDto } from './dto/create-collection.dto.js';
import { UpdateCollectionDto } from './dto/update-collection.dto.js';
import { QueryCollectionDto } from './dto/query-collection.dto.js';

@AdminController('collections')
export class AdminCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  create(@Body() createCollectionDto: CreateCollectionDto) {
    return this.collectionsService.create(createCollectionDto);
  }

  @Get()
  findAll(@Query() query: QueryCollectionDto) {
    return this.collectionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.collectionsService.findOne(id);
  }

  @Patch('reorder')
  async reorderCollections(@Body('items') items: { id: string; order: number }[]) {
    await this.collectionsService.reorderCollections(items || []);
    return { success: true };
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(id, updateCollectionDto);
  }

  @Patch(':id/active')
  toggleActive(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.collectionsService.toggleActive(id, isActive);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.collectionsService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.collectionsService.restore(id);
  }
}
