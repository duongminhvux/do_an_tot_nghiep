/// <reference types="multer" />
import { IdentityTokenVerifier } from '../auth/service-jwt.module.js';
import { assertAdminPermissions } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { Body,Get,NotFoundException,Param,Post,Req,Sse,UploadedFile,UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { concatMap,interval,startWith,takeWhile } from 'rxjs';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { AudioProcessingService } from './audio-processing.service.js';
import { AudioQueueService } from './audio-queue.service.js';
import { BulkToeicAudioDto,BulkVocabularyAudioDto,GenerateToeicAudioDto,GenerateVocabularyAudioDto } from './dto/audio-generation.dto.js';

@AdminController('audio')
export class AdminAudioController {
  constructor(
    private readonly audioProcessing: AudioProcessingService,
    private readonly audioQueue: AudioQueueService,
    private readonly identity: IdentityTokenVerifier,
  ) {}

  @RequirePermissions('audio.read')
  @Get('voices')
  voices() {
    return this.audioProcessing.voices();
  }

  @RequirePermissions('audio.generate', 'vocabulary.update')
  @Post('vocabulary/:id/generate')
  async generateVocabulary(@Param('id') id: string, @Body() dto: GenerateVocabularyAudioDto) {
    if (dto.accent === 'both') {
      const us = await this.audioProcessing.generateVocabularyAudio(id, 'us', dto.voiceId);
      const uk = await this.audioProcessing.generateVocabularyAudio(id, 'uk');
      return { us, uk };
    }
    return this.audioProcessing.generateVocabularyAudio(id, dto.accent || 'us', dto.voiceId);
  }


  @RequirePermissions('audio.upload', 'vocabulary.update')
  @Post('vocabulary/:id/upload/:accent')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  uploadVocabulary(
    @Param('id') id: string,
    @Param('accent') accent: 'us' | 'uk',
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.audioProcessing.uploadVocabularyAudio(id, accent, file);
  }

  @RequirePermissions('audio.upload', 'toeic.update')
  @Post('toeic/questions/:id/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadQuestion(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.audioProcessing.uploadToeicQuestionAudio(id, file);
  }

  @RequirePermissions('audio.upload', 'toeic.update')
  @Post('toeic/passages/:id/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  uploadPassage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.audioProcessing.uploadToeicPassageAudio(id, file);
  }

  @RequirePermissions('audio.generate', 'vocabulary.update')
  @Post('vocabulary/bulk')
  bulkVocabulary(@Body() dto: BulkVocabularyAudioDto) {
    return this.audioQueue.enqueueVocabularyBulk(dto.ids, dto.accent || 'us');
  }

  @RequirePermissions('audio.generate', 'toeic.update')
  @Post('toeic/questions/:id/generate')
  generateQuestion(@Param('id') id: string, @Body() dto: GenerateToeicAudioDto) {
    return this.audioProcessing.generateToeicQuestionAudio(id, dto.primaryVoiceId, dto.secondaryVoiceId);
  }

  @RequirePermissions('audio.generate', 'toeic.update')
  @Post('toeic/passages/:id/generate')
  generatePassage(@Param('id') id: string, @Body() dto: GenerateToeicAudioDto) {
    return this.audioProcessing.generateToeicPassageAudio(id, dto.primaryVoiceId, dto.secondaryVoiceId);
  }

  @RequirePermissions('audio.generate', 'toeic.update')
  @Post('toeic/exams/:examId/generate')
  generateExam(@Param('examId') examId: string, @Body() dto: BulkToeicAudioDto) {
    return this.audioQueue.enqueueToeicExam(examId, dto.parts);
  }

  // Opt-in asynchronous alternatives. Existing synchronous endpoints are untouched.
  @RequirePermissions('audio.generate', 'vocabulary.update')
  @Post('vocabulary/:id/enqueue')
  enqueueVocabulary(@Param('id') id: string, @Body() dto: GenerateVocabularyAudioDto) {
    if (dto.accent === 'both') return this.audioQueue.enqueueVocabularyBulk([id], 'both');
    return this.audioQueue.enqueueVocabularySingle(id, dto.accent || 'us', dto.voiceId);
  }

  @RequirePermissions('audio.generate', 'toeic.update')
  @Post('toeic/questions/:id/enqueue')
  enqueueQuestion(@Param('id') id: string, @Body() dto: GenerateToeicAudioDto) {
    return this.audioQueue.enqueueToeicQuestionSingle(id, dto.primaryVoiceId, dto.secondaryVoiceId);
  }

  @RequirePermissions('audio.generate', 'toeic.update')
  @Post('toeic/passages/:id/enqueue')
  enqueuePassage(@Param('id') id: string, @Body() dto: GenerateToeicAudioDto) {
    return this.audioQueue.enqueueToeicPassageSingle(id, dto.primaryVoiceId, dto.secondaryVoiceId);
  }

  @RequirePermissions('audio.workers.read')
  @Get('workers/config')
  workerConfig() { return this.audioQueue.workerConfig(); }

  @RequirePermissions('audio.workers.update')
  @Post('workers/config')
  saveWorkerConfig(@Body() body: { maxWorkers: number; backlogThreshold: number }) {
    return this.audioQueue.configureWorkers(body);
  }

  @RequirePermissions('audio.workers.read')
  @Get('workers/metrics')
  workerMetrics() { return this.audioQueue.queueMetrics(); }

  @RequirePermissions('audio.jobs.read')
  @Sse('jobs/:id/events')
  events(@Param('id') id: string, @Req() req: any) {
    return interval(1500).pipe(
      startWith(0),
      concatMap(async () => {
        const raw=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'');
        assertAdminPermissions(await this.identity.verifyToken(raw),['audio.jobs.read']);
        const job = await this.audioQueue.status(id);
        return { data: job ?? { error: 'not_found' } };
      }),
      takeWhile((event) => !['completed','failed'].includes(
        (event.data as any).state || ''), true),
    );
  }

  @RequirePermissions('audio.jobs.read')
  @Get('jobs/:id')
  async job(@Param('id') id: string) {
    const result = await this.audioQueue.status(id);
    if (!result) throw new NotFoundException('Audio job not found.');
    return result;
  }
}
