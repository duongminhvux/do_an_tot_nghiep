/** All app processes on host, ONLY supporting infra/AI remain Dockerized. */
import {spawn,spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
const root=resolve(import.meta.dirname,'..');
if(!existsSync(resolve(root,'.env')))throw new Error('Missing root .env. Copy .env.example to .env and configure passwords.');
process.loadEnvFile(resolve(root,'.env'));
const roles=[['identity',5001],['content',5002],['assessment',5003],['arena',5004],
 ['learning',5005],['media-jobs',5006],['ai-import',5007],['notification',5008]];
const selected=(process.argv.slice(2).join(',')||'all').split(',').map(x=>x.trim());
const isAll=selected.includes('all');
const runners=[];
if (isAll || roles.some(([role]) => selected.includes(role))) {
  const migration=spawnSync(process.execPath,['scripts/migrate.mjs','--all'],{
    cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432'},stdio:'inherit'
  });
  if(migration.status!==0)throw new Error('PostgreSQL migrations failed; refusing to start local backends');
}

function start(name,args,env){
 const child=spawn(name,args,{cwd:root,env:{...process.env,...env},stdio:'inherit',shell:process.platform==='win32'});
 child.on('exit',(code)=>{console.log('[dev-local] process exit',name,args.join(' '),code)});runners.push(child);
}
for(const [role,port] of roles){
 if(!isAll&&!selected.includes(role))continue;
 const r=role==='media-jobs'?'media':role.replaceAll('-','_');
 const password=process.env[`PG_${r.toUpperCase()}_PASSWORD`];
 if(!password)throw new Error(`Missing PG_${r.toUpperCase()}_PASSWORD in root .env`);
 const env={SERVICE_ROLE:role,PORT:String(port),PGHOST:'127.0.0.1',PGPORT:'5432',
   PGDATABASE:`${r}_db`,PGUSER:`vl_${r}`,PGPASSWORD:password,
   REDIS_URL:'redis://localhost:6379',RABBITMQ_URL:`amqp://${process.env.RABBITMQ_USER}:${encodeURIComponent(process.env.RABBITMQ_PASSWORD||'')}@127.0.0.1:5672/%2F`,
   FRONTEND_URL:'http://localhost:3000',ADMIN_URL:'http://localhost:3001',
   IDENTITY_INTROSPECTION_URL:'http://127.0.0.1:5001/api/_internal/identity/introspect',
   CONTENT_INTERNAL_URL:'http://127.0.0.1:5002',ASSESSMENT_INTERNAL_URL:'http://127.0.0.1:5003',
   IDENTITY_INTERNAL_URL:'http://127.0.0.1:5001',ARENA_INTERNAL_URL:'http://127.0.0.1:5004',
   MEDIA_JOBS_INTERNAL_URL:'http://127.0.0.1:5006',AI_IMPORT_INTERNAL_URL:'http://127.0.0.1:5007',
   LEARNING_INTERNAL_URL:'http://127.0.0.1:5005',NOTIFICATION_INTERNAL_URL:'http://127.0.0.1:5008',
   MEDIA_BRIDGE_URL:'http://127.0.0.1:8010',RABBIT_JOB_BROKER_URL:'http://127.0.0.1:8020',
   ASR_JOB_API_URL:'http://127.0.0.1:8021',TTS_SERVICE_URL:'http://127.0.0.1:8001',
   ASR_SERVICE_URL:'http://127.0.0.1:8002',PDF_AI_URL:'http://127.0.0.1:8003',
   MEDIA_STORAGE_BACKEND:'s3',S3_ENDPOINT:'http://127.0.0.1:9000',
 };
 start('pnpm',['--dir','apps/api','exec','nest','start','--watch','--entryFile',`entrypoints/${role}`],env);
}
// The media job runner inside Docker calls the native audio worker at port 5009.
if (isAll || selected.includes('audio-worker')) {
 const env={SERVICE_ROLE:'audio-worker',AUDIO_QUEUE_BACKEND:'rabbitmq',AUDIO_WORKER_PORT:'5009',
   PGHOST:'127.0.0.1',PGPORT:'5432',PGDATABASE:'media_db',PGUSER:'vl_media',
   PGPASSWORD:process.env.PG_MEDIA_PASSWORD,
   MEDIA_STORAGE_BACKEND:'s3',MEDIA_BRIDGE_URL:'http://127.0.0.1:8010',
   RABBIT_JOB_BROKER_URL:'http://127.0.0.1:8020',ASR_JOB_API_URL:'http://127.0.0.1:8021',
   CONTENT_INTERNAL_URL:'http://127.0.0.1:5002',ASSESSMENT_INTERNAL_URL:'http://127.0.0.1:5003'};
 if (!env.PGPASSWORD) throw new Error('PG_MEDIA_PASSWORD missing');
 start('pnpm',['--dir','apps/api','exec','nest','start','--watch','--entryFile','audio-worker-main'],env);
}
if(isAll||selected.includes('gateway'))start(process.execPath,['scripts/dev-gateway.mjs'],{});
if(isAll||selected.includes('web'))start('pnpm',['--filter','web','dev'],{NEXT_PUBLIC_API_URL:'http://localhost:5000/api'});
if(isAll||selected.includes('admin-web'))start('pnpm',['--filter','admin_web','dev'],{NEXT_PUBLIC_API_URL:'http://localhost:5000/api'});
process.on('SIGINT',()=>{for(const child of runners)child.kill('SIGINT');process.exit(0)});
