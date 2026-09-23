import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Word, WordSchema } from './words/word.schema.js';
import { WordsController } from './words/words.controller.js';
import { AdminWordsController } from './words/admin-words.controller.js';
import { WordsService } from './words/words.service.js';

import { Collection, CollectionSchema } from './collections/collection.schema.js';
import { CollectionsController } from './collections/collections.controller.js';
import { AdminCollectionsController } from './collections/admin-collections.controller.js';
import { CollectionsService } from './collections/collections.service.js';

import { Lesson, LessonSchema } from './lessons/lesson.schema.js';
import { Section, SectionSchema } from './lessons/section.schema.js';
import { LessonWord, LessonWordSchema } from './lessons/lesson-word.schema.js';
import { LessonsController } from './lessons/lessons.controller.js';
import { AdminLessonsController } from './lessons/admin-lessons.controller.js';
import { LessonsService } from './lessons/lessons.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Word.name, schema: WordSchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Section.name, schema: SectionSchema },
      { name: LessonWord.name, schema: LessonWordSchema },
    ]),
  ],
  controllers: [
    WordsController,
    AdminWordsController,
    CollectionsController,
    AdminCollectionsController,
    LessonsController,
    AdminLessonsController,
  ],
  providers: [
    WordsService,
    CollectionsService,
    LessonsService,
  ],
  exports: [
    WordsService,
    CollectionsService,
    LessonsService,
    MongooseModule,
  ],
})
export class VocabularyModule {}
