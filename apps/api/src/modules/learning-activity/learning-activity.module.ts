import { ActiveTimeService } from './active-time.service.js';
import { Global, Module } from '@nestjs/common';
import { PgModelsModule } from '../../postgres/compat.js';
import {
  LearningActivity,
  LearningActivitySchema } from './schemas/learning-activity.schema.js';
import { LearningActivityService } from './learning-activity.service.js';
import { LearningActivityController } from './learning-activity.controller.js';
import { InternalLearningActivityController } from './internal-learning-activity.controller.js';

// Global so every learning module can record completions without importing it.
@Global()
@Module({
  imports: [
    PgModelsModule.forFeature([
      { name: LearningActivity.name, schema: LearningActivitySchema },
    ]),
  ],
  controllers: [LearningActivityController, InternalLearningActivityController],
  providers: [LearningActivityService, ActiveTimeService],
  exports: [LearningActivityService] })
export class LearningActivityModule {}
