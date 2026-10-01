import { Module } from '@nestjs/common';
import { AttemptsService } from './attempts.service.js';
import { AttemptsController } from './attempts.controller.js';

@Module({
  controllers: [AttemptsController],
  providers: [AttemptsService],
})
export class AttemptsModule {}
