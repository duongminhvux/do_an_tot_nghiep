/** Run inside Identity. Creates isolated fixtures, then deletes them through owner APIs. */
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
require('reflect-metadata');
const {Pool}=require('pg'),{JwtService}=require('@nestjs/jwt'),{ConfigService}=require('@nestjs/config');
const {MediaStorageService}=await import('../apps/api/dist/common/media/media-storage.service.js');
const pool=new Pool(),storage=new MediaStorageService(new ConfigService());
const base=process.env.SMOKE_GATEWAY_URL||'http://gateway:5000';
const prefix=`audio-regression-${randomUUID()}`,cleanup=[],objects=[];
let token;
async function api(path,method='GET',body) {
  const response=await fetch(`${base}/api${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
  const text=await response.text();
  assert.equal(response.status,method==='POST'?201:200,`${method} ${path}: ${text.slice(0,500)}`);
  console.log(`${response.status} ${method} ${path}`);
  return JSON.parse(text).data;
}
async function playable(key) {
  assert(key,'Generated audio must have a storage key');objects.push(key);
  const response=await fetch(`${base}/media/${key}`,{method:'HEAD'});
  assert.equal(response.status,200,'Generated audio must be served through the gateway');
}
try {
  const admin=(await pool.query('SELECT id FROM admins WHERE is_deleted=false LIMIT 1')).rows[0];
  assert(admin,'Administrator required');
  token=await new JwtService().signAsync({_id:admin.id,role:'ADMIN'},{secret:process.env.JWT_ACCESS_SECRET,expiresIn:'10m'});
  const word=await api('/admin/words','POST',{word:prefix,level:'A1',parts:[{partOfSpeech:'noun',meanings:[{definition:'Audio test fixture'}]}]});
  cleanup.push(`/admin/words/${word._id}`);
  const vocabulary=await api(`/admin/audio/vocabulary/${word._id}/generate`,'POST',{accent:'us'});
  assert.equal(vocabulary.audioMeta.us.status,'READY');await playable(vocabulary.audioMeta.us.storageKey);
  const group=await api('/admin/exam-groups','POST',{name:prefix});cleanup.push(`/admin/exam-groups/${group._id}`);
  const exam=await api('/admin/exams','POST',{name:prefix,type:'TOEIC',groupId:group._id});cleanup.push(`/admin/exams/${exam._id}`);
  const question=await api('/admin/questions','POST',{examId:exam._id,section:'LISTENING',part:2,content:'Where is the office?',options:[{key:'A',text:'On the first floor.'},{key:'B',text:'Tomorrow morning.'},{key:'C',text:'I am fine.'}],correctAnswer:'A',order:1});cleanup.push(`/admin/questions/${question._id}`);
  const listed=await api(`/admin/exam-groups?limit=100&search=${prefix}`);
  assert.equal(listed.data.length,1);assert.equal(listed.data[0]._id,group._id);assert.equal(listed.data[0].examCount,1);
  assert.equal((await api(`/admin/exam-groups/${listed.data[0]._id}/exams`)).length,1);
  const queued=await api(`/admin/audio/toeic/exams/${exam._id}/generate`,'POST',{parts:[2]});
  let job;
  const deadline=Date.now()+180000;
  do {
    await new Promise(resolve=>setTimeout(resolve,1500));
    job=await api(`/admin/audio/jobs/${queued.jobId}`);
    if(['completed','failed'].includes(job.state))break;
  }while(Date.now()<deadline);
  assert.equal(job.state,'completed',`Queue job failed: ${job.failedReason}`);
  assert.equal(job.result.succeeded,1);assert.equal(job.result.failed,0);
  const generatedQuestion=await api(`/admin/questions/${question._id}`);
  assert.equal(generatedQuestion.audioMeta.status,'READY');await playable(generatedQuestion.audioMeta.storageKey);
  const lesson=await api('/admin/dictation','POST',{title:prefix,level:'A1',sourceText:'Hello world. Welcome back.',voiceIds:['af_heart'],language:'en-US'});cleanup.push(`/admin/dictation/${lesson._id}`);
  const generated=await api(`/admin/dictation/${lesson._id}/generate-audio`,'POST',{});
  assert.equal(generated.status,'READY');assert.equal(generated.segments.length,2);await playable(generated.fullAudioStorageKey);
  console.log('Real HTTP + PostgreSQL + TTS + RabbitMQ: word, exam-group navigation, worker audio and dictation audio passed');
} finally {
  const failures=[];
  for(const path of cleanup.reverse())try{await api(path,'DELETE');}catch(error){failures.push(error);}
  for(const key of objects)try{await storage.delete(key);}catch(error){failures.push(error);}
  await pool.end();
  if(failures.length)throw new AggregateError(failures,'Fixture cleanup failed');
}
