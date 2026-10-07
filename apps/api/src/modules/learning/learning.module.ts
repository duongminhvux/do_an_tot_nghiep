import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressController } from './progress/progress.controller.js';
import { ProgressService } from './progress/progress.service.js';
import { ReviewsController } from './reviews/reviews.controller.js';
import { ReviewsService } from './reviews/reviews.service.js';
import { SessionsController } from './sessions/sessions.controller.js';
import { SessionsService } from './sessions/sessions.service.js';
import {
  UserLessonProgress,
  UserLessonProgressSchema,
} from './progress/schemas/user-lesson-progress.schema.js';
import {
  UserLessonWord,
  UserLessonWordSchema,
} from './progress/schemas/user-lesson-word.schema.js';
import {
  UserWordReview,
  UserWordReviewSchema,
} from './reviews/schemas/user-word-review.schema.js';
import {
  UserDailyActivity,
  UserDailyActivitySchema,
} from './progress/schemas/user-daily-activity.schema.js';
import {
  LearningSession,
  LearningSessionSchema,
} from './sessions/schemas/learning-session.schema.js';
import {
  LearningSessionWord,
  LearningSessionWordSchema,
} from './sessions/schemas/learning-session-word.schema.js';

import { VocabularyModule } from '../vocabulary/vocabulary.module.js';
import { SavedWordsModule } from './saved-words/saved-words.module.js';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js';

@Module({
  imports: [
    VocabularyModule,
    SavedWordsModule,
    ActivityLogsModule,
    MongooseModule.forFeature([
      {
        name: UserLessonProgress.name,
        schema: UserLessonProgressSchema,
      },
      {
        name: UserLessonWord.name,
        schema: UserLessonWordSchema,
      },
      {
        name: UserWordReview.name,
        schema: UserWordReviewSchema,
      },
      {
        name: LearningSession.name,
        schema: LearningSessionSchema,
      },
      {
        name: LearningSessionWord.name,
        schema: LearningSessionWordSchema,
      },
      {
        name: UserDailyActivity.name,
        schema: UserDailyActivitySchema,
      },
    ]),
    SavedWordsModule,
  ],
  controllers: [
    ProgressController,
    ReviewsController,
    SessionsController,
  ],
  providers: [
    ProgressService,
    ReviewsService,
    SessionsService,
  ],
  exports: [
    ProgressService,
    ReviewsService,
    SessionsService,
    SavedWordsModule,
    MongooseModule,
  ],
})
export class LearningModule {}
