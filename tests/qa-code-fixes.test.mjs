import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const ts=createRequire(new URL('../apps/admin-web/package.json',import.meta.url))('typescript');
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const payloadUrl=moduleUrl(await readFile(new URL('../apps/admin-web/lib/api-payload.ts',import.meta.url),'utf8'));
const http={get:async()=>{throw Error('Unexpected HTTP')},post:async()=>{throw Error('Unexpected HTTP')}};
globalThis.__qaHttp=http;
const axiosUrl=moduleUrl('export default globalThis.__qaHttp;');
const audioSource=(await readFile(new URL('../apps/admin-web/services/audio.service.ts',import.meta.url),'utf8')).replace("'@/lib/axios'",JSON.stringify(axiosUrl)).replace("'@/lib/api-payload'",JSON.stringify(payloadUrl));
const {audioService}=await import(moduleUrl(audioSource));
const {groupAttemptProgress}=await import(moduleUrl(await readFile(new URL('../apps/web/features/toeic/attempt/group-progress.ts',import.meta.url),'utf8')));
test('audio client unwraps health/config/metrics/job envelopes while retaining raw endpoint compatibility',async()=>{
  const config={maxWorkers:1,backlogThreshold:10,note:'ready'},health={checkedAt:'now',services:[{name:'content',state:'healthy'}]},metrics={backend:'rabbitmq',waiting:0};
  http.get=async path=>({data:{statusCode:200,data:path.endsWith('/services')?health:path.endsWith('/config')?config:path.endsWith('/metrics')?metrics:{id:'job',state:'completed'}}});
  assert.deepEqual(await audioService.getServiceHealth(),health);assert.deepEqual(await audioService.getWorkerConfig(),config);assert.deepEqual(await audioService.getQueueMetrics(),metrics);assert.equal((await audioService.getJob('job')).state,'completed');
  http.post=async()=>({data:{data:config}});assert.deepEqual(await audioService.setWorkerConfig(config),config);
  http.get=async()=>({data:health});assert.deepEqual(await audioService.getServiceHealth(),health);
});
test('malformed health/config raises a recoverable error rather than passing undefined services into map',async()=>{
  http.get=async()=>({data:{data:{}}});await assert.rejects(audioService.getServiceHealth(),/Invalid service health/);await assert.rejects(audioService.getWorkerConfig(),/Invalid worker configuration/);
});
test('group cards recognize both completed statuses and use answered count rather than snapshot size',()=>{
  for(const status of ['FINISHED','COMPLETED'])assert.deepEqual(groupAttemptProgress({status,totalQuestions:30,answeredQuestions:4}),{completed:true,inProgress:false,total:30,answered:4,percent:100});
  assert.equal(groupAttemptProgress({status:'IN_PROGRESS',totalQuestions:10,answeredQuestions:2}).percent,20);
  assert.equal(groupAttemptProgress({status:'IN_PROGRESS',totalQuestions:10,answeredQuestions:100}).percent,100);
  assert.equal(groupAttemptProgress({status:'ABANDONED',totalQuestions:10}).percent,0);
  assert.equal(groupAttemptProgress().percent,0);
});
