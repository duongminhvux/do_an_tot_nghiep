import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Word, WordSchema } from './words/word.schema.js';
import { VocabularyGroup, VocabularyGroupSchema } from './groups/vocabulary-group.schema.js';
import { Collection, CollectionSchema } from './collections/collection.schema.js';
import { Lesson, LessonSchema } from './lessons/lesson.schema.js';
import { Section, SectionSchema } from './lessons/section.schema.js';
import { LessonWord, LessonWordSchema } from './lessons/lesson-word.schema.js';

/** Local RabbitMQ-fed projections only: never expose Content CRUD routes. */
@Module({
  imports: [MongooseModule.forFeature([
    {name:Word.name,schema:WordSchema},
    {name:VocabularyGroup.name,schema:VocabularyGroupSchema},
    {name:Collection.name,schema:CollectionSchema},
    {name:Lesson.name,schema:LessonSchema},
    {name:Section.name,schema:SectionSchema},
    {name:LessonWord.name,schema:LessonWordSchema},
  ])],
  exports:[MongooseModule],
})
export class VocabularyReadModelsModule {}
