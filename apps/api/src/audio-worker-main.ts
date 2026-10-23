import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { AudioWorkerModule } from './audio-worker.module.js';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { DatabaseVersionDocument } from './platform/database-documents.js';

async function main() {
  if (process.env.AUDIO_QUEUE_BACKEND !== 'rabbitmq') {
    throw new Error('Isolated worker requires AUDIO_QUEUE_BACKEND=rabbitmq');
  }
  const app = await NestFactory.create(AudioWorkerModule, { logger: ['error','warn','log'] });
  const db = app.get<Connection>(getConnectionToken()).db;
  const manifest=readFileSync(resolve(process.cwd(),'database/schema/collections.json'));
  const checksum=createHash('sha256').update(manifest).digest('hex');
  const schemaVersion=(JSON.parse(manifest.toString('utf8')) as {schemaVersion:number}).schemaVersion;
  const ready = await db?.collection<DatabaseVersionDocument>('database_versions').findOne({
    _id:'schema_manifest_current',role:'media-jobs',schemaVersion,schemaChecksum:checksum
  });
  if (!ready) throw new Error('Media database schema not reconciled; db-init must succeed first');
  await app.listen(Number(process.env.AUDIO_WORKER_PORT || '5001'), '0.0.0.0');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
