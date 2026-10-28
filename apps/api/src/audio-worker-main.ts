import { NestFactory } from '@nestjs/core';
import { AudioWorkerModule } from './audio-worker.module.js';
import { getConnectionToken,type PgConnection } from './postgres/connection.js';
async function main(){
  if(process.env.SERVICE_ROLE&&process.env.SERVICE_ROLE!=='audio-worker')throw new Error('Audio worker requires SERVICE_ROLE=audio-worker');
  process.env.SERVICE_ROLE='audio-worker';
  if(process.env.AUDIO_QUEUE_BACKEND!=='rabbitmq')throw new Error('AUDIO_QUEUE_BACKEND=rabbitmq required');
  const app=await NestFactory.create(AudioWorkerModule,{logger:['error','warn','log']});
  const conn=app.get<PgConnection>(getConnectionToken());
  const result=await conn.query('SELECT current_database() AS name');
  if(result.rows[0]?.name!=='media_db')throw new Error('Audio worker requires media_db');
  await app.listen(Number(process.env.AUDIO_WORKER_PORT||'5001'),'0.0.0.0');
}
main().catch(error=>{console.error(error);process.exitCode=1});
