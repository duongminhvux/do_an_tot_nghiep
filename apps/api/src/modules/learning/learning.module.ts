import { Module } from '@nestjs/common';
import { AdminMistakesController,MistakesController } from './mistakes/mistakes.controller.js';
import { MistakesService } from './mistakes/mistakes.service.js';
import { RecommendationsController } from './recommendations/recommendations.controller.js';
import { RecommendationsService } from './recommendations/recommendations.service.js';

import { ProgressController } from './progress/progress.controller.js';
import { ProgressService } from './progress/progress.service.js';
import { ReviewsController } from './reviews/reviews.controller.js';
import { ReviewsService } from './reviews/reviews.service.js';
import { SessionsController } from './sessions/sessions.controller.js';
import { SessionsService } from './sessions/sessions.service.js';








import { LearningActivityModule } from '../learning-activity/learning-activity.module.js';
import { SavedWordsModule } from './saved-words/saved-words.module.js';

@Module({
  imports: [SavedWordsModule,
LearningActivityModule],
  controllers: [
    MistakesController, AdminMistakesController,
    RecommendationsController,
    ProgressController,
    ReviewsController,
    SessionsController,
  ],
  providers: [
    MistakesService,
    RecommendationsService,
    ProgressService,
    ReviewsService,
    SessionsService,
  ],
  exports: [ProgressService,
ReviewsService,
SessionsService,
SavedWordsModule] })
export class LearningModule {}
