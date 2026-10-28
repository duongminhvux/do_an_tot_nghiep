import { Get } from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';

// Fixed upstream allowlist. Never proxy user-supplied URLs from this endpoint.
const SERVICES = [
  ['identity', 'http://identity-service:5000/api/health'],
  ['content', 'http://content-service:5000/api/health'],
  ['assessment', 'http://assessment-service:5000/api/health'],
  ['learning', 'http://learning-service:5000/api/health'],
  ['arena', 'http://arena-service:5000/api/health'],
  ['ai-import', 'http://ai-import-service:5000/api/health'],
  ['notification', 'http://notification-service:5000/api/health'],
  ['tts', process.env.TTS_SERVICE_URL?.replace(/\/$/, '') + '/health'],
  ['asr', process.env.ASR_SERVICE_URL?.replace(/\/$/, '') + '/health'],
  ['qwen-pdf', process.env.PDF_AI_URL?.replace(/\/$/, '') + '/health'],
] as const;

@AdminController('infrastructure')
export class AdminInfrastructureController {
  @Get('services')
  async health() {
    return {
      checkedAt: new Date().toISOString(),
      services: await Promise.all(SERVICES.map(async ([name, url]) => {
        if (url.startsWith('undefined/')) return { name, state: 'not-configured' };
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
          return { name, state: response.ok ? 'healthy' : 'unhealthy', status: response.status };
        } catch {
          return { name, state: 'unreachable' };
        }
      })) };
  }
}
