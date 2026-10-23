import { Injectable } from '@nestjs/common';
import { InjectPgConnection } from '../../postgres/compat.js';
import {makePgModel,type PgConnection} from '../../postgres/compat.js';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AudioProcessingService } from './audio-processing.service.js';
import type { AudioWorkerSettingsDocument } from '../../platform/database-documents.js';

type AudioJobData =
  | { type: 'VOCAB_BULK'; ids: string[]; accent: 'us' | 'uk' | 'both' }
  | { type: 'TOEIC_EXAM_BULK'; examId: string; parts?: number[] }
  | { type: 'VOCAB_SINGLE'; id: string; accent: 'us' | 'uk'; voiceId?: string }
  | { type: 'TOEIC_QUESTION_SINGLE'; id: string; primaryVoiceId?: string; secondaryVoiceId?: string }
  | { type: 'TOEIC_PASSAGE_SINGLE'; id: string; primaryVoiceId?: string; secondaryVoiceId?: string };

interface StoredAudioJob {
  id: string;
  name: string;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  data: AudioJobData;
  progress: unknown;
  result?: unknown;
  failedReason?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

/** RabbitMQ only. PostgreSQL is the durable job state and lease store;
 * Redis is reserved for Arena/Socket.IO and is not an audio task queue.
 */
@Injectable()
export class AudioQueueService {
  constructor(
    private readonly config: ConfigService,
    private readonly audioProcessing: AudioProcessingService,
    @InjectPgConnection() private readonly connection: PgConnection,
  ) {}

  private jobs() {
    return makePgModel('AudioJob',this.connection.pool);
  }

  private async enqueue(name:string,data:AudioJobData) {
    const id=randomUUID();
    const job:StoredAudioJob = {id,name,data,state:'waiting',createdAt:new Date().toISOString(),
      progress:{processed:0,total:0,succeeded:0,failed:0}};
    await this.jobs().create({...job});
    // Publishing can time out after broker accepted a message. If that happens,
    // keep a retryable job, never silently delete it from PostgreSQL.
    const url=this.config.get<string>('RABBIT_JOB_BROKER_URL')||'http://job-broker:8020';
    const token=this.config.get<string>('JOB_INTERNAL_TOKEN')||'';
    if(token.length<24) throw new Error('JOB_INTERNAL_TOKEN not configured');
    try {
      const response=await fetch(`${url}/publish`,{method:'POST',
        headers:{'content-type':'application/json','x-internal-token':token},
        body:JSON.stringify({jobId:id,name}),signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error(`RabbitMQ publish rejected: ${response.status}`);
    } catch(error) {
      await this.jobs().updateOne({id},{$set:{state:'failed',
        failedReason:`Publisher state uncertain: ${String(error)}`}});
      throw error;
    }
    return {jobId:id};
  }

  private async runJob(job:StoredAudioJob, onProgress:(data:unknown)=>Promise<void>) {
    const data=job.data;
    switch(data.type) {
      case 'VOCAB_BULK':return this.audioProcessing.generateVocabularyBatch(data.ids,data.accent,onProgress);
      case 'TOEIC_EXAM_BULK':return this.audioProcessing.generateToeicExamBatch(data.examId,data.parts,onProgress);
      case 'VOCAB_SINGLE':return this.audioProcessing.generateVocabularyAudio(data.id,data.accent,data.voiceId);
      case 'TOEIC_QUESTION_SINGLE':return this.audioProcessing.generateToeicQuestionAudio(data.id,data.primaryVoiceId,data.secondaryVoiceId);
      case 'TOEIC_PASSAGE_SINGLE':return this.audioProcessing.generateToeicPassageAudio(data.id,data.primaryVoiceId,data.secondaryVoiceId);
    }
  }

  /** Called from the authenticated worker endpoint. RabbitMQ ACK comes only
   * after durable completion. PostgreSQL lease allows retry after worker death.
   */
  async executeQueuedJob(jobId:string) {
    const jobs=this.jobs(), now=new Date(), lockOwner=randomUUID();
    const claimed=await jobs.findOneAndUpdate({id:jobId,$or:[
      {state:{$in:['waiting','failed']}},
      {state:'active',leaseUntil:{$lt:now}},
    ]},{$set:{state:'active',lockOwner,leaseUntil:new Date(now.getTime()+180000),
      startedAt:now.toISOString(),failedReason:''}} ,{returnDocument:'after'});
    if(!claimed) {
      const existing=await jobs.findOne({id:jobId});
      if(!existing) throw new Error(`Unknown audio job: ${jobId}`);
      if(existing.state==='completed') return existing.result;
      throw new Error(`Job ${jobId} busy or terminal; cannot claim`);
    }
    const timer=setInterval(()=>{void jobs.updateOne({id:jobId,lockOwner},
      {$set:{leaseUntil:new Date(Date.now()+180000)}}).catch(error=>console.error('Audio job heartbeat failed',error));},60000);
    timer.unref();
    try {
      const progress=async(value:unknown)=>{await jobs.updateOne({id:jobId,lockOwner},{$set:{progress:value}});};
      const result=await this.runJob(claimed as unknown as StoredAudioJob,progress);
      const updated=await jobs.updateOne({id:jobId,lockOwner},{$set:{state:'completed',result,
        finishedAt:new Date().toISOString()},$unset:{lockOwner:'',leaseUntil:''}});
      if(!updated.matchedCount) throw new Error('Audio job ownership lost before completion');
      return result;
    }catch(error) {
      await jobs.updateOne({id:jobId,lockOwner},{$set:{state:'failed',
        failedReason:error instanceof Error?error.message:String(error),finishedAt:new Date().toISOString()},
        $unset:{lockOwner:'',leaseUntil:''}});
      throw error;
    }finally {clearInterval(timer);}
  }

  enqueueVocabularySingle(id:string,accent:'us'|'uk',voiceId?:string) {
    return this.enqueue('vocab-single',{type:'VOCAB_SINGLE',id,accent,voiceId});
  }
  enqueueToeicQuestionSingle(id:string,primaryVoiceId?:string,secondaryVoiceId?:string) {
    return this.enqueue('toeic-question-single',{type:'TOEIC_QUESTION_SINGLE',id,primaryVoiceId,secondaryVoiceId});
  }
  enqueueToeicPassageSingle(id:string,primaryVoiceId?:string,secondaryVoiceId?:string) {
    return this.enqueue('toeic-passage-single',{type:'TOEIC_PASSAGE_SINGLE',id,primaryVoiceId,secondaryVoiceId});
  }
  enqueueVocabularyBulk(ids:string[],accent:'us'|'uk'|'both') {
    return this.enqueue('vocab-bulk',{type:'VOCAB_BULK',ids,accent});
  }
  enqueueToeicExam(examId:string,parts?:number[]) {
    return this.enqueue('toeic-exam-bulk',{type:'TOEIC_EXAM_BULK',examId,parts});
  }

  async workerConfig() {
    const config=await makePgModel('SystemSetting',this.connection.pool).findOne({key:'audio_worker'});
    return {maxWorkers:config?.maxWorkers===2?2:1,backlogThreshold:config?.backlogThreshold||10,
      note:'Worker count is provisioned by Docker/operations; no GPU autoscaler is enabled.'};
  }
  async configureWorkers(input:{maxWorkers:number;backlogThreshold:number}) {
    const maxWorkers=Number(input?.maxWorkers),backlogThreshold=Number(input?.backlogThreshold);
    if(![1,2].includes(maxWorkers)||!Number.isInteger(backlogThreshold)||backlogThreshold<1||backlogThreshold>1000)
      throw new Error('Invalid worker settings');
    await makePgModel('SystemSetting',this.connection.pool).updateOne({key:'audio_worker'},
      {$set:{maxWorkers,backlogThreshold}},{upsert:true});
    return this.workerConfig();
  }
  async queueMetrics() {
    const url=this.config.get<string>('RABBIT_JOB_BROKER_URL')||'http://job-broker:8020';
    const token=this.config.get<string>('JOB_INTERNAL_TOKEN')||'';
    const response=await fetch(`${url}/stats`,{headers:{'x-internal-token':token},signal:AbortSignal.timeout(5000)});
    if(!response.ok) throw new Error(`Broker unavailable: ${response.status}`);
    return {backend:'rabbitmq',...(await response.json() as object)};
  }
  async status(jobId:string) {
    const job=await this.jobs().findOne({id:jobId});
    if(!job)return null;
    return {id:job.id,name:job.name,state:job.state,progress:job.progress,result:job.result,
      failedReason:job.failedReason||'',timestamp:job.createdAt,startedAt:job.startedAt,
      finishedAt:job.finishedAt};
  }
}
