import { Module } from '@nestjs/common';
import { ContentSqlRepository } from './content-sql.repository.js';

import { WordsController } from './words/words.controller.js';
import { AdminWordsController } from './words/admin-words.controller.js';
import { WordsService } from './words/words.service.js';

import { VocabularyGroupsController } from './groups/vocabulary-groups.controller.js';
import { AdminVocabularyGroupsController } from './groups/admin-vocabulary-groups.controller.js';
import { VocabularyGroupsService } from './groups/vocabulary-groups.service.js';

import { CollectionsController } from './collections/collections.controller.js';
import { AdminCollectionsController } from './collections/admin-collections.controller.js';
import { CollectionsService } from './collections/collections.service.js';

import { LessonsController } from './lessons/lessons.controller.js';
import { AdminLessonsController } from './lessons/admin-lessons.controller.js';
import { LessonsService } from './lessons/lessons.service.js';

@Module({
  controllers: [
    WordsController,
    AdminWordsController,
    VocabularyGroupsController,
    AdminVocabularyGroupsController,
    CollectionsController,
    AdminCollectionsController,
    LessonsController,
    AdminLessonsController,
  ],
  providers: [
    ContentSqlRepository,
    WordsService,
    VocabularyGroupsService,
    CollectionsService,
    LessonsService,
  ],
  exports: [
    WordsService,
    VocabularyGroupsService,
    CollectionsService,
    LessonsService,
  ],
})
export class VocabularyModule {}
