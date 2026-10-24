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
      await this.jobs().updateOne({id},{$set:{
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

  /** Atomic SQL claim: unlike document filtering, PostgreSQL serializes competing
   * workers at the row and returns the actual fencing generation. */
  private async claimJob(jobId: string, owner: string): Promise<{job: StoredAudioJob; generation: number} | null> {
    const result = await this.connection.query(`
      UPDATE public.audio_jobs
         SET state = 'active', lease_owner = $2::uuid,
             lease_until = now() + interval '3 minutes',
             lease_generation = lease_generation + 1,
             run_attempts = run_attempts + 1,
             payload = payload || jsonb_build_object('state','active','lockOwner',$2::text,
                'startedAt',now()::text,'failedReason','')
       WHERE id = $1::uuid
         AND ((state IN ('waiting','failed') AND next_attempt_at <= now())
           OR (state = 'active' AND lease_until < now()))
         AND run_attempts < max_attempts
      RETURNING payload, lease_generation`, [jobId, owner]);
    if (!result.rows.length) return null;
    return {job: result.rows[0].payload as StoredAudioJob,
      generation: Number(result.rows[0].lease_generation)};
  }

  private async updateLease(jobId: string, owner: string, generation: number,
    updateSql: string, params: unknown[] = []): Promise<boolean> {
    const result = await this.connection.query(`
      UPDATE public.audio_jobs SET ${updateSql}
       WHERE id=$1::uuid AND state='active' AND lease_owner=$2::uuid
         AND lease_generation=$3 AND lease_until>now()
      RETURNING id`, [jobId, owner, generation, ...params]);
    return result.rows.length === 1;
  }

  /** Called by the authenticated audio worker. The owner UUID and the
   * monotonically increasing lease_generation fence late/stale workers. */
  async executeQueuedJob(jobId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(jobId)) throw new Error('Invalid audio job ID');
    const owner = randomUUID();
    const lease = await this.claimJob(jobId, owner);
    if (!lease) {
      const existing = await this.jobs().findOne({id:jobId});
      if (!existing) throw new Error(`Unknown audio job: ${jobId}`);
      if (existing.state === 'completed') return existing.result;
      throw new Error(`Job ${jobId} busy, delayed or exhausted retries`);
    }
    const {job, generation} = lease;
    let lostLease = false;
    const timer = setInterval(() => {void this.updateLease(jobId, owner, generation,
      "lease_until=now()+interval '3 minutes'"
    ).then(ok => { if(!ok) lostLease=true; }).catch(error => {
      lostLease=true; console.error('Audio lease heartbeat failed', error);
    });}, 60_000);
    timer.unref();
    try {
      const progress = async (value: unknown) => {
        if(lostLease || !await this.updateLease(jobId, owner, generation,
          "payload=payload||jsonb_build_object('progress',$4::jsonb)",
          [JSON.stringify(value ?? null)])) {
          lostLease=true; throw new Error('Audio lease lost while reporting progress');
        }
      };
      const result = await this.runJob(job, progress);
      if(lostLease || !await this.updateLease(jobId, owner, generation,
        `state='completed', lease_owner=NULL, lease_until=NULL,
         payload=(payload || jsonb_build_object('state','completed','result',$4::jsonb,
           'finishedAt',now()::text)) - 'lockOwner' - 'leaseUntil'`,
        [JSON.stringify(result ?? null)])) throw new Error('Audio job lease lost before completion');
      return result;
    } catch(error) {
      // A worker that lost its lease must never overwrite the new owner's state.
      await this.updateLease(jobId, owner, generation,
        `state='failed', lease_owner=NULL, lease_until=NULL,
         next_attempt_at=now()+interval '10 seconds',
         payload=(payload || jsonb_build_object('state','failed','failedReason',$4::text,
           'finishedAt',now()::text)) - 'lockOwner' - 'leaseUntil'`,
        [error instanceof Error ? error.message : String(error)]);
      throw error;
    } finally {clearInterval(timer);}
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
