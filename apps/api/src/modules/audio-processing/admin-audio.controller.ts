/// <reference types="multer" />
import { Body, Get, NotFoundException, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { AudioProcessingService } from './audio-processing.service.js';
import { AudioQueueService } from './audio-queue.service.js';
import { BulkToeicAudioDto, BulkVocabularyAudioDto, GenerateToeicAudioDto, GenerateVocabularyAudioDto } from './dto/audio-generation.dto.js';

@AdminController('audio')
export class AdminAudioController {
  constructor(
    private readonly audioProcessing: AudioProcessingService,
    private readonly audioQueue: AudioQueueService,
  ) {}

  @Get('voices')
  voices() {
    return this.audioProcessing.voices();
  }

  @Post('vocabulary/:id/generate')
  async generateVocabulary(@Param('id') id: string, @Body() dto: GenerateVocabularyAudioDto) {
    if (dto.accent === 'both') {
      const us = await this.audioProcessing.generateVocabularyAudio(id, 'us', dto.voiceId);
      const uk = await this.audioProcessing.generateVocabularyAudio(id, 'uk');
      return { us, uk };
    }
    return this.audioProcessing.generateVocabularyAudio(id, dto.accent || 'us', dto.voiceId);
  }


  @Post('vocabulary/:id/upload/:accent')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  uploadVocabulary(
    @Param('id') id: string,
    @Param('accent') accent: 'us' | 'uk',
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.audioProcessing.uploadVocabularyAudio(id, accent, file);
  }

  @Post('toeic/questions/:id/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadQuestion(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.audioProcessing.uploadToeicQuestionAudio(id, file);
  }

  @Post('toeic/passages/:id/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  uploadPassage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.audioProcessing.uploadToeicPassageAudio(id, file);
  }

  @Post('vocabulary/bulk')
  bulkVocabulary(@Body() dto: BulkVocabularyAudioDto) {
    return this.audioQueue.enqueueVocabularyBulk(dto.ids, dto.accent || 'us');
  }

  @Post('toeic/questions/:id/generate')
  generateQuestion(@Param('id') id: string, @Body() dto: GenerateToeicAudioDto) {
    return this.audioProcessing.generateToeicQuestionAudio(id, dto.primaryVoiceId, dto.secondaryVoiceId);
  }

  @Post('toeic/passages/:id/generate')
  generatePassage(@Param('id') id: string, @Body() dto: GenerateToeicAudioDto) {
    return this.audioProcessing.generateToeicPassageAudio(id, dto.primaryVoiceId, dto.secondaryVoiceId);
  }

  @Post('toeic/exams/:examId/generate')
  generateExam(@Param('examId') examId: string, @Body() dto: BulkToeicAudioDto) {
    return this.audioQueue.enqueueToeicExam(examId, dto.parts);
  }

  @Get('jobs/:id')
  async job(@Param('id') id: string) {
    const result = await this.audioQueue.status(id);
    if (!result) throw new NotFoundException('Audio job not found.');
    return result;
  }
}
