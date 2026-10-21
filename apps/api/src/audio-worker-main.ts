import { NestFactory } from '@nestjs/core';
import { AudioWorkerModule } from './audio-worker.module.js';

async function main() {
  if (process.env.AUDIO_QUEUE_BACKEND !== 'rabbitmq') {
    throw new Error('Isolated worker requires AUDIO_QUEUE_BACKEND=rabbitmq');
  }
  const app = await NestFactory.create(AudioWorkerModule, { logger: ['error','warn','log'] });
  await app.listen(Number(process.env.AUDIO_WORKER_PORT || '5001'), '0.0.0.0');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
