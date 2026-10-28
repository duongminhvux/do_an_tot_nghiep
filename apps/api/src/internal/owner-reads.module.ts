import { Module } from '@nestjs/common';
import { AssessmentReadsController } from './assessment-reads.controller.js';
import { ContentReadsController } from './content-reads.controller.js';
import { DashboardReadsController } from './dashboard-reads.controller.js';
import { LearningReadsController } from './learning-reads.controller.js';
import { MiniGameSourceSummaryController } from './minigame-source-summary.controller.js';
import { MistakeSourceController } from './mistake-source.controller.js';
import { RecommendationSummaryController } from './recommendation-summary.controller.js';
@Module({controllers:[MiniGameSourceSummaryController,RecommendationSummaryController,MistakeSourceController,ContentReadsController,AssessmentReadsController,LearningReadsController,DashboardReadsController]})
export class OwnerReadsModule {}
