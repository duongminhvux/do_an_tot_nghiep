import { WordShooterSettingsDto } from './dto/word-shooter-settings.dto.js';
import { TypingRushSettingsDto } from './dto/typing-rush-settings.dto.js';
import { MeaningTypingSettingsDto } from './dto/meaning-typing-settings.dto.js';
import { Body, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { GameCatalogService } from './services/game-catalog.service.js';
import { MiniGameAdminService } from './services/minigame-admin.service.js';
import {
  MiniGameResultQueryDto,
  TopScoresQueryDto,
} from './dto/minigame-result-query.dto.js';
import { UpdateGameDto } from './dto/game-definition.dto.js';

@AdminController('minigames')
export class AdminMinigameController {
  constructor(
    private readonly catalog: GameCatalogService,
    private readonly admin: MiniGameAdminService,
  ) {}

  @Get()
  games() {
    return this.catalog.list();
  }

  @Get(':gameType/settings') configuration(
    @Param('gameType') gameType: string,
  ) {
    return this.catalog.configuration(gameType);
  }
  @Patch('TYPING_RUSH/settings') updateTypingRushConfiguration(
    @Body() dto: TypingRushSettingsDto,
  ) {
    return this.catalog.updateConfiguration('TYPING_RUSH', dto);
  }
  @Patch('MEANING_TYPING/settings') updateMeaningTypingConfiguration(
    @Body() dto: MeaningTypingSettingsDto,
  ) {
    return this.catalog.updateMeaningTypingConfiguration('MEANING_TYPING', dto);
  }
  @Patch('WORD_SHOOTER/settings') updateWordShooterConfiguration(
    @Body() dto: WordShooterSettingsDto,
  ) {
    return this.catalog.updateWordShooterConfiguration(dto);
  }
  @Patch(':gameType/settings') configurationUpdateFallback(
    @Param('gameType') gameType: string,
    @Body() dto: TypingRushSettingsDto,
  ) {
    return this.catalog.updateConfiguration(gameType, dto);
  }

  @Patch(':gameType')
  updateGame(@Param('gameType') gameType: string, @Body() dto: UpdateGameDto) {
    return this.catalog.updateByCode(gameType, dto);
  }

  @Put(':gameType')
  replaceGame(@Param('gameType') gameType: string, @Body() dto: UpdateGameDto) {
    return this.catalog.updateByCode(gameType, dto);
  }

  @Get('results')
  results(@Query() query: MiniGameResultQueryDto) {
    return this.admin.list(query);
  }

  @Get('statistics')
  statistics() {
    return this.admin.statistics();
  }

  @Get(':gameType/top-scores')
  topScores(
    @Param('gameType') gameType: string,
    @Query() query: TopScoresQueryDto,
  ) {
    return this.admin.topScores(gameType, query);
  }
}
