import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExamsService } from './exams.service.js';
import { ExamsController } from './exams.controller.js';
import { AdminExamsController } from './admin-exams.controller.js';
import { Exam, ExamSchema } from './schemas/exam.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Exam.name, schema: ExamSchema }]),
  ],
  controllers: [ExamsController, AdminExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
