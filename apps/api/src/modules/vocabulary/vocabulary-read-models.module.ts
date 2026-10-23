import { Module } from '@nestjs/common';
import { PgModelsModule } from '../../postgres/compat.js';
import { Word, WordSchema } from './words/word.schema.js';
import { VocabularyGroup, VocabularyGroupSchema } from './groups/vocabulary-group.schema.js';
import { Collection, CollectionSchema } from './collections/collection.schema.js';
import { Lesson, LessonSchema } from './lessons/lesson.schema.js';
import { Section, SectionSchema } from './lessons/section.schema.js';
import { LessonWord, LessonWordSchema } from './lessons/lesson-word.schema.js';

/** Read models use Content's authenticated HTTP API outside the Content process. */
@Module({
  imports: [PgModelsModule.forFeature([
    {name:Word.name,schema:WordSchema},
    {name:VocabularyGroup.name,schema:VocabularyGroupSchema},
    {name:Collection.name,schema:CollectionSchema},
    {name:Lesson.name,schema:LessonSchema},
    {name:Section.name,schema:SectionSchema},
    {name:LessonWord.name,schema:LessonWordSchema},
  ])],
  exports:[PgModelsModule] })
export class VocabularyReadModelsModule {}
