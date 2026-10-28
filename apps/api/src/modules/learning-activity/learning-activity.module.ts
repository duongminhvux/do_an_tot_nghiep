import { Global,Module } from '@nestjs/common';
import { ActiveTimeService } from './active-time.service.js';


import { InternalLearningActivityController } from './internal-learning-activity.controller.js';
import { LearningActivityController } from './learning-activity.controller.js';
import { LearningActivityService } from './learning-activity.service.js';

// Global so every learning module can record completions without importing it.
@Global()
@Module({
  imports: [],
  controllers: [LearningActivityController, InternalLearningActivityController],
  providers: [LearningActivityService, ActiveTimeService],
  exports: [LearningActivityService] })
export class LearningActivityModule {}
