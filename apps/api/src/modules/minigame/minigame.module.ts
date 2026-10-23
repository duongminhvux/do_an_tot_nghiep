import { AdminGamesController } from './admin-games.controller.js';
import { GameCatalogService } from './services/game-catalog.service.js';
import {
  GameDefinition,
  GameDefinitionSchema } from './schemas/game-definition.schema.js';
import { Module } from '@nestjs/common';
import { LearningActivityModule } from '../learning-activity/learning-activity.module.js';
import { PgModelsModule } from '../../postgres/compat.js';
import {
  Collection,
  CollectionSchema } from '../vocabulary/collections/collection.schema.js';
import { Lesson, LessonSchema } from '../vocabulary/lessons/lesson.schema.js';
import {
  LessonWord,
  LessonWordSchema } from '../vocabulary/lessons/lesson-word.schema.js';
import { Word, WordSchema } from '../vocabulary/words/word.schema.js';
import {
  VocabularyFolder,
  VocabularyFolderSchema } from '../learning/saved-words/schema/vocabulary-folder.schema.js';
import {
  UserSavedWord,
  UserSavedWordSchema } from '../learning/saved-words/schema/saved-word.schema.js';
import {
  MiniGameResult,
  MiniGameResultSchema } from './schemas/minigame-result.schema.js';
import { User, UserSchema } from '../users/schema/user.schema.js';
import { MiniGameController } from './minigame.controller.js';
import { MiniGameWordSourceService } from './services/minigame-word-source.service.js';
import { MiniGameResultService } from './services/minigame-result.service.js';
import { MiniGameAdminService } from './services/minigame-admin.service.js';
import { AdminMinigameController } from './admin-minigame.controller.js';
@Module({
  imports: [
    LearningActivityModule,
    PgModelsModule.forFeature([
      { name: GameDefinition.name, schema: GameDefinitionSchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: LessonWord.name, schema: LessonWordSchema },
      { name: Word.name, schema: WordSchema },
      { name: VocabularyFolder.name, schema: VocabularyFolderSchema },
      { name: UserSavedWord.name, schema: UserSavedWordSchema },
      { name: MiniGameResult.name, schema: MiniGameResultSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
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
