import { Module } from '@nestjs/common';
import { PgModelsModule } from '../../../postgres/compat.js';
import { SavedWordsService } from './saved-words.service.js';
import { SavedWordsController } from './saved-words.controller.js';
import {
  UserSavedWord,
  UserSavedWordSchema } from './schema/saved-word.schema.js';
import {
  UserWordReview,
  UserWordReviewSchema } from '../reviews/schemas/user-word-review.schema.js';
import {
  VocabularyFolder,
  VocabularyFolderSchema } from './schema/vocabulary-folder.schema.js';
import { VocabularyReadModelsModule } from '../../vocabulary/vocabulary-read-models.module.js';

@Module({
  imports: [
    VocabularyReadModelsModule,
    PgModelsModule.forFeature([
      { name: UserSavedWord.name, schema: UserSavedWordSchema },
      { name: UserWordReview.name, schema: UserWordReviewSchema },
      { name: VocabularyFolder.name, schema: VocabularyFolderSchema },
    ]),
  ],
  controllers: [SavedWordsController],
  providers: [SavedWordsService],
  exports: [SavedWordsService, PgModelsModule] })
export class SavedWordsModule {}
