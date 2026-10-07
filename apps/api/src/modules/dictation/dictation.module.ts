import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DictationService } from './dictation.service.js';
import { DictationController } from './dictation.controller.js';
import { AdminDictationController } from './admin-dictation.controller.js';
import {
  DictationLesson,
  DictationLessonSchema,
} from './schemas/dictation-lesson.schema.js';
import {
  DictationSegment,
  DictationSegmentSchema,
} from './schemas/dictation-segment.schema.js';
import {
  DictationProgress,
  DictationProgressSchema,
} from './schemas/dictation-progress.schema.js';
import { TtsModule } from '../tts/tts.module.js';
import { UploadModule } from '../upload/upload.module.js';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DictationLesson.name, schema: DictationLessonSchema },
      { name: DictationSegment.name, schema: DictationSegmentSchema },
      { name: DictationProgress.name, schema: DictationProgressSchema },
    ]),
    TtsModule,
    UploadModule,
    ActivityLogsModule,
  ],
  controllers: [DictationController, AdminDictationController],
  providers: [DictationService],
  exports: [DictationService],
})
export class DictationModule {}
