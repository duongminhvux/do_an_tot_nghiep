import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import {
  SynthesizeSequenceTtsDto,
  SynthesizeTtsDto,
} from './tts.dto.js';
import { TtsService, type TtsAudioResult } from './tts.service.js';

@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Public()
  @Get('health')
  health() {
    return this.ttsService.health();
  }

  @Public()
  @Get('voices')
  voices() {
    return this.ttsService.voices();
  }

  @Post('synthesize')
  async synthesize(
    @Body() payload: SynthesizeTtsDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.ttsService.synthesize(payload);
    this.sendAudio(response, result);
  }

  @Post('synthesize-sequence')
  async synthesizeSequence(
    @Body() payload: SynthesizeSequenceTtsDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.ttsService.synthesizeSequence(payload);
    this.sendAudio(response, result);
  }

  private sendAudio(response: Response, result: TtsAudioResult): void {
    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Length', result.audio.length.toString());

    if (result.durationMs) {
      response.setHeader('X-Audio-Duration-Ms', result.durationMs);
    }
    if (result.sampleRate) {
      response.setHeader('X-Audio-Sample-Rate', result.sampleRate);
    }
    if (result.provider) {
      response.setHeader('X-TTS-Provider', result.provider);
    }
    if (result.device) {
      response.setHeader('X-TTS-Device', result.device);
    }

    response.status(200).send(result.audio);
  }
}
