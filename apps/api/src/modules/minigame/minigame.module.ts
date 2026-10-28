import { AdminGamesController } from './admin-games.controller.js';
import { GameCatalogService } from './services/game-catalog.service.js';

import { Module } from '@nestjs/common';
import { LearningActivityModule } from '../learning-activity/learning-activity.module.js';









import { AdminMinigameController } from './admin-minigame.controller.js';
import { MiniGameController } from './minigame.controller.js';
import { MiniGameAdminService } from './services/minigame-admin.service.js';
import { MiniGameResultService } from './services/minigame-result.service.js';
import { MiniGameWordSourceService } from './services/minigame-word-source.service.js';
@Module({
  imports: [LearningActivityModule],
  controllers: [
    MiniGameController,
    AdminGamesController,
    AdminMinigameController,
  ],
  providers: [
    MiniGameWordSourceService,
    MiniGameResultService,
    GameCatalogService,
    MiniGameAdminService,
  ] })
export class MiniGameModule {}
