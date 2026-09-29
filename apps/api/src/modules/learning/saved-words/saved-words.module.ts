import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SavedWordsService } from './saved-words.service.js';
import { SavedWordsController } from './saved-words.controller.js';
import {
  UserSavedWord,
  UserSavedWordSchema,
} from './schema/saved-word.schema.js';
import {
  UserWordReview,
  UserWordReviewSchema,
} from '../reviews/schemas/user-word-review.schema.js';
import { VocabularyModule } from '../../vocabulary/vocabulary.module.js';

@Module({
  imports: [
    VocabularyModule,
    MongooseModule.forFeature([
      { name: UserSavedWord.name, schema: UserSavedWordSchema },
      { name: UserWordReview.name, schema: UserWordReviewSchema },
    ]),
  ],
  controllers: [SavedWordsController],
  providers: [SavedWordsService],
  exports: [SavedWordsService, MongooseModule],
})
export class SavedWordsModule {}
