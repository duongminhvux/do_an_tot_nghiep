import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LearningActivity,
  LearningActivitySchema,
} from './schemas/learning-activity.schema.js';
import { LearningActivityService } from './learning-activity.service.js';
import { LearningActivityController } from './learning-activity.controller.js';

// Global so every learning module can record completions without importing it.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LearningActivity.name, schema: LearningActivitySchema },
    ]),
  ],
  controllers: [LearningActivityController],
  providers: [LearningActivityService],
  exports: [LearningActivityService],
})
export class LearningActivityModule {}
