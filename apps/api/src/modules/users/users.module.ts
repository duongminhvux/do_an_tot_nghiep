import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { AdminUsersController } from './admin-users.controller.js';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schema/user.schema.js';
import {
  UserLessonWord,
  UserLessonWordSchema,
} from '../learning/progress/schemas/user-lesson-word.schema.js';
import {
  UserLessonProgress,
  UserLessonProgressSchema,
} from '../learning/progress/schemas/user-lesson-progress.schema.js';
import {
  LearningSession,
  LearningSessionSchema,
} from '../learning/sessions/schemas/learning-session.schema.js';
import {
  UserWordReview,
  UserWordReviewSchema,
} from '../learning/reviews/schemas/user-word-review.schema.js';
import {
  UserDailyActivity,
  UserDailyActivitySchema,
} from '../learning/progress/schemas/user-daily-activity.schema.js';
import { Lesson, LessonSchema } from '../vocabulary/lessons/lesson.schema.js';
import {
  LessonWord,
  LessonWordSchema,
} from '../vocabulary/lessons/lesson-word.schema.js';
import { Word, WordSchema } from '../vocabulary/words/word.schema.js';
import {
  Collection,
  CollectionSchema,
} from '../vocabulary/collections/collection.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserLessonWord.name, schema: UserLessonWordSchema },
      { name: UserLessonProgress.name, schema: UserLessonProgressSchema },
      { name: LearningSession.name, schema: LearningSessionSchema },
      { name: UserWordReview.name, schema: UserWordReviewSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: LessonWord.name, schema: LessonWordSchema },
      { name: Word.name, schema: WordSchema },
      { name: Collection.name, schema: CollectionSchema },
      { name: UserDailyActivity.name, schema: UserDailyActivitySchema },
    ]),
  ],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

