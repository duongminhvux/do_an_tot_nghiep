import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { Body,Get,Param,Patch } from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { ReorderGamesDto,UpdateGameDto } from './dto/game-definition.dto.js';
import { GameCatalogService } from './services/game-catalog.service.js';
@AdminController('games')
export class AdminGamesController {
  constructor(private readonly catalog: GameCatalogService) {}
  @RequirePermissions('games.read')
  @Get() list() {
    return this.catalog.list();
  }
  @RequirePermissions('games.update')
  @Patch('reorder') reorder(@Body() dto: ReorderGamesDto) {
    return this.catalog.reorder(dto);
  }
  @RequirePermissions('games.update')
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateGameDto) {
    return this.catalog.update(id, dto);
  }
}
