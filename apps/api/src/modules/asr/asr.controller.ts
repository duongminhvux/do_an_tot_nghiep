import { Get,Param,Post,ServiceUnavailableException,UploadedFile,UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { AsrService } from './asr.service.js';

@AdminController('asr')
export class AsrController {
  constructor(private readonly asrService: AsrService, private readonly config: ConfigService) {}

  private async jobRequest(path: string, init: RequestInit) {
    const base = this.config.get<string>('ASR_JOB_API_URL');
    const token = this.config.get<string>('JOB_INTERNAL_TOKEN');
    if (!base || !token) throw new ServiceUnavailableException('ASR job queue is not configured');
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: { ...init.headers, 'x-internal-token': token },
        signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`Job API returned ${response.status}`);
      return response.json();
    } catch {
      throw new ServiceUnavailableException('ASR job service is unavailable');
    }
  }

  @Post('jobs')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async enqueue(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new ServiceUnavailableException('Audio file is required');
    const form = new FormData();
    const bytes = new Uint8Array(file.buffer);
    form.set('file', new Blob([bytes], { type: file.mimetype || 'application/octet-stream' }), file.originalname);
    form.set('language', 'en');
    return this.jobRequest('/jobs', { method: 'POST', body: form });
  }

  @Get('jobs/:id')
  status(@Param('id') id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ServiceUnavailableException('Invalid job ID');
    return this.jobRequest(`/jobs/${id}`, { method: 'GET' });
  }

  @Get('health')
  health() {
    return this.asrService.health();
  }
}
