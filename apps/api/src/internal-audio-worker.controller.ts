import { Controller,Get,Headers,HttpException,Param,Post } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { AudioQueueService } from './modules/audio-processing/audio-queue.service.js';

@Controller('_internal/audio')
export class InternalAudioWorkerController {
  constructor(private readonly queue: AudioQueueService) {}

  @Get('health')
  health() { return {status: 'ok'}; }

  @Post('jobs/:id')
  async execute(@Param('id') id: string, @Headers('x-internal-token') token: string) {
    const expected = process.env.JOB_INTERNAL_TOKEN || '';
    const supplied = Buffer.from(token || '');
    const secret = Buffer.from(expected);
    if (secret.length < 24 || supplied.length !== secret.length || !timingSafeEqual(supplied, secret)) {
      throw new HttpException('Forbidden', 403);
    }
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpException('Invalid job id', 400);
    return { result: await this.queue.executeQueuedJob(id) };
  }
}
