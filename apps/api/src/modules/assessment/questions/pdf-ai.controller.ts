/// <reference types="multer" />
import {
BadRequestException,
Body,
Get,
Param,
Post,
UploadedFiles,
UseInterceptors
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { IsIn,IsInt,IsString,Max,MaxLength,Min,MinLength } from 'class-validator';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { PdfAiLearningService } from './pdf-ai-learning.service.js';
import { PdfAiService } from './pdf-ai.service.js';

class ReviewCorrectionDto {
  @IsIn(['gold', 'rejected']) status: 'gold' | 'rejected';
  @IsString() @MinLength(3) @MaxLength(2000) note: string;
}

class BundleOptionsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  testNumber: number;
}

@AdminController('pdf-ai')
export class PdfAiBundleController {
  constructor(private readonly pdfAi: PdfAiService, private readonly learning: PdfAiLearningService) {}

  @Get('learning')
  learningOverview() { return this.learning.overview(); }

  @Post('learning/:sampleId/review')
  reviewCorrection(@Param('sampleId') sampleId: string, @Body() body: ReviewCorrectionDto) {
    if (!/^[a-f0-9]{64}$/.test(sampleId)) throw new BadRequestException('Mã mẫu không hợp lệ.');
    return this.pdfAi.learningRequest(`/samples/${sampleId}/review`, body);
  }

  @Post('learning/retry')
  async retryLearning() { await this.learning.flush(); return this.learning.overview(); }

  @Post('bundle-jobs')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'lc', maxCount: 1 },
        { name: 'rc', maxCount: 1 },
        { name: 'lc_answers', maxCount: 1 },
        { name: 'rc_answers', maxCount: 1 },
        { name: 'lc_script', maxCount: 1 },
      ],
      { limits: { fileSize: 25 * 1024 * 1024, files: 5, fields: 1 } },
    ),
  )
  start(
    @Body() body: BundleOptionsDto,
    @UploadedFiles()
    files?: Partial<
      Record<'lc' | 'rc' | 'lc_answers' | 'rc_answers' | 'lc_script', Express.Multer.File[]>
    >,
  ) {
    return this.pdfAi.startBundle(body.testNumber, files || {});
  }

  @Get('bundle-jobs/:jobId')
  status(@Param('jobId') jobId: string) {
    return this.pdfAi.bundleStatus(jobId);
  }
}

@AdminController('exams/:examId/pdf-ai')
export class PdfAiController {
  constructor(private readonly pdfAi: PdfAiService) {}

  @Post('jobs')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'answers', maxCount: 1 },
      ],
      {
        limits: { fileSize: 25 * 1024 * 1024, files: 2, fields: 0 } },
    ),
  )
  start(
    @Param('examId') examId: string,
    @UploadedFiles()
    files?: { file?: Express.Multer.File[]; answers?: Express.Multer.File[] },
  ) {
    return this.pdfAi.start(examId, files?.file?.[0], files?.answers?.[0]);
  }

  @Get('jobs/:jobId')
  status(@Param('examId') examId: string, @Param('jobId') jobId: string) {
    return this.pdfAi.status(examId, jobId);
  }
}
