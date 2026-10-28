import { Module } from '@nestjs/common';

import {
AdminAttemptsController,
AdminExamAttemptsController
} from './admin-attempts.controller.js';
import {
AttemptsController,
ExamPartsController
} from './attempts.controller.js';
import { AttemptsService } from './attempts.service.js';






@Module({
  imports: [],
  controllers: [
    AttemptsController,
    ExamPartsController,
    AdminAttemptsController,
    AdminExamAttemptsController,
  ],
  providers: [AttemptsService] })
export class AttemptsModule {}
