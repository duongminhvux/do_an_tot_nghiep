import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { RedisService } from '../../common/redis/redis.service.js';
import { AudioProcessingService } from './audio-processing.service.js';

const QUEUE_KEY = 'audio:queue';
const JOB_PREFIX = 'audio:job:';
const JOB_TTL_SECONDS = 7 * 24 * 60 * 60;

type AudioQueueWorkerClient = {
  isOpen: boolean;
  on(event: 'error', listener: (error: Error) => void): unknown;
  connect(): Promise<unknown>;
  quit(): Promise<unknown>;
  brPop(key: string, timeout: number): Promise<{ key: string; element: string } | null>;
};

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

@Injectable()
export class AudioQueueService implements OnModuleInit, OnModuleDestroy {
  private workerClients: AudioQueueWorkerClient[] = [];
  private stopped = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly audioProcessing: AudioProcessingService,
    @Optional() @InjectConnection() private readonly connection?: Connection,
  ) {}

  async onModuleInit() {
    // RabbitMQ mode is served by the independent audio-worker process.
    if (this.configService.get<string>('AUDIO_QUEUE_BACKEND') === 'rabbitmq') return;
    const concurrency = Math.max(
      1,
      Math.min(4, Number(this.configService.get<string>('AUDIO_QUEUE_CONCURRENCY') || '1')),
    );
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    for (let index = 0; index < concurrency; index += 1) {
      const client = createClient({ url: redisUrl }) as unknown as AudioQueueWorkerClient;
      client.on('error', (error) => console.error(`Audio queue worker ${index + 1} Redis error:`, error));
      await client.connect();
      this.workerClients.push(client);
      void this.workerLoop(client, index + 1);
    }
  }

  async onModuleDestroy() {
    this.stopped = true;
    await Promise.allSettled(
      this.workerClients.map((client) => (client.isOpen ? client.quit() : Promise.resolve())),
    );
  }

  private jobKey(id: string) {
    return `${JOB_PREFIX}${id}`;
  }

  private async saveJob(job: StoredAudioJob) {
    // Durable history survives Redis eviction/restart. Redis remains the fast
    // state cache used by existing job-runner and Admin polling.
    const db = this.connection?.db;
    if (db) {
      await db.collection('audio_jobs').updateOne(
        { id: job.id }, { $set: { ...job } }, { upsert: true },
      );
    }
    await this.redisService.getClient().set(this.jobKey(job.id), JSON.stringify(job),
      { EX: JOB_TTL_SECONDS });
  }

  private async loadJob(id: string): Promise<StoredAudioJob | null> {
    let raw: string | null = null;
    try { raw = await this.redisService.getClient().get(this.jobKey(id)); }
    catch { /* fall back to durable store */ }
    if (raw) {
      try { return JSON.parse(raw) as StoredAudioJob; }
      catch { /* corrupted cache; query MongoDB */ }
    }
    const doc = await this.connection?.db?.collection('audio_jobs').findOne({ id });
    if (!doc) return null;
    const { _id, ...stored } = doc;
    return stored as unknown as StoredAudioJob;
  }

  private async updateProgress(job: StoredAudioJob, progress: unknown) {
    job.progress = progress;
    await this.saveJob(job);
  }

  private async workerLoop(client: AudioQueueWorkerClient, workerNumber: number) {
    while (!this.stopped && client.isOpen) {
      try {
        const item = await client.brPop(QUEUE_KEY, 2);
        if (!item?.element) continue;
        const job = await this.loadJob(item.element);
        if (!job || job.state !== 'waiting') continue;

        job.state = 'active';
        job.startedAt = new Date().toISOString();
        await this.saveJob(job);

        try {
          const result = await this.runJob(job);
          job.state = 'completed';
          job.result = result;
          job.finishedAt = new Date().toISOString();
          await this.saveJob(job);
        } catch (error) {
          job.state = 'failed';
          job.failedReason = error instanceof Error ? error.message : String(error);
          job.finishedAt = new Date().toISOString();
          await this.saveJob(job);
        }
      } catch (error) {
        if (!this.stopped) {
          console.error(`Audio queue worker ${workerNumber} failed:`, error);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  }

  private async enqueue(name: string, data: AudioJobData) {
    const id = randomUUID();
    const job: StoredAudioJob = {
      id,
      name,
      state: 'waiting',
      data,
      progress: { processed: 0, total: 0, succeeded: 0, failed: 0 },
      createdAt: new Date().toISOString(),
    };
    await this.saveJob(job);
    if (this.configService.get<string>('AUDIO_QUEUE_BACKEND') === 'rabbitmq') {
      const url = this.configService.get<string>('RABBIT_JOB_BROKER_URL') || 'http://job-broker:8020';
      const token = this.configService.get<string>('JOB_INTERNAL_TOKEN') || '';
      if (!token) throw new Error('JOB_INTERNAL_TOKEN must be configured for RabbitMQ mode');
      try {
        const response = await fetch(`${url}/publish`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-token': token },
          body: JSON.stringify({ jobId: id, name }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`RabbitMQ broker rejected job: ${response.status}`);
      } catch (error) {
        job.state = 'failed';
        job.failedReason = error instanceof Error ? error.message : String(error);
        await this.saveJob(job);
        throw error;
      }
    } else {
      await this.redisService.getClient().lPush(QUEUE_KEY, id);
    }
    return { jobId: id };
  }

  private async runJob(job: StoredAudioJob): Promise<unknown> {
    const data = job.data;
    switch (data.type) {
      case 'VOCAB_BULK':
        return this.audioProcessing.generateVocabularyBatch(data.ids, data.accent,
          (progress) => this.updateProgress(job, progress));
      case 'TOEIC_EXAM_BULK':
        return this.audioProcessing.generateToeicExamBatch(data.examId, data.parts,
          (progress) => this.updateProgress(job, progress));
      case 'VOCAB_SINGLE':
        return this.audioProcessing.generateVocabularyAudio(data.id, data.accent, data.voiceId);
      case 'TOEIC_QUESTION_SINGLE':
        return this.audioProcessing.generateToeicQuestionAudio(data.id, data.primaryVoiceId, data.secondaryVoiceId);
      case 'TOEIC_PASSAGE_SINGLE':
        return this.audioProcessing.generateToeicPassageAudio(data.id, data.primaryVoiceId, data.secondaryVoiceId);
    }
  }

  // Called only from the authenticated internal audio-worker endpoint.
  // State is persisted in Redis as before so existing Admin progress polling still works.
  async executeQueuedJob(jobId: string) {
    const redis = this.redisService.getClient();
    const lockKey = `audio:lock:${jobId}`;
    const acquired = await redis.set(lockKey, 'active', { NX: true, EX: 60 * 60 });
    if (!acquired) throw new Error('Job is already executing; retry after lock expiry');
    try {
      const job = await this.loadJob(jobId);
      if (!job) throw new Error(`Unknown audio job ${jobId}`);
      if (job.state === 'completed') return job.result;
      job.state = 'active';
      job.startedAt = new Date().toISOString();
      job.failedReason = '';
      await this.saveJob(job);
      try {
        const result = await this.runJob(job);
        job.state = 'completed';
        job.result = result;
        job.finishedAt = new Date().toISOString();
        await this.saveJob(job);
        return result;
      } catch (error) {
        job.state = 'failed';
        job.failedReason = error instanceof Error ? error.message : String(error);
        job.finishedAt = new Date().toISOString();
        await this.saveJob(job);
        throw error;
      }
    } finally {
      await redis.del(lockKey);
    }
  }

  enqueueVocabularySingle(id: string, accent: 'us' | 'uk', voiceId?: string) {
    return this.enqueue('vocab-single', {type: 'VOCAB_SINGLE', id, accent, voiceId});
  }

  enqueueToeicQuestionSingle(id: string, primaryVoiceId?: string, secondaryVoiceId?: string) {
    return this.enqueue('toeic-question-single', {type: 'TOEIC_QUESTION_SINGLE', id, primaryVoiceId, secondaryVoiceId});
  }

  enqueueToeicPassageSingle(id: string, primaryVoiceId?: string, secondaryVoiceId?: string) {
    return this.enqueue('toeic-passage-single', {type: 'TOEIC_PASSAGE_SINGLE', id, primaryVoiceId, secondaryVoiceId});
  }

  enqueueVocabularyBulk(ids: string[], accent: 'us' | 'uk' | 'both') {
    return this.enqueue('vocab-bulk', { type: 'VOCAB_BULK', ids, accent });
  }

  enqueueToeicExam(examId: string, parts?: number[]) {
    return this.enqueue('toeic-exam-bulk', { type: 'TOEIC_EXAM_BULK', examId, parts });
  }

  async workerConfig() {
    const raw = await this.redisService.getClient().get('audio:worker:config');
    let parsed: any = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }
    return {
      maxWorkers: parsed.maxWorkers === 2 ? 2 : 1,
      backlogThreshold: Number.isInteger(parsed.backlogThreshold) && parsed.backlogThreshold >= 1 && parsed.backlogThreshold <= 1000
        ? parsed.backlogThreshold : 10,
      note: 'Two consumers require a provisioned secondary worker and GPU admission; changing this setting does not start a Docker container.',
    };
  }

  async configureWorkers(config: { maxWorkers: number; backlogThreshold: number }) {
    const maxWorkers = Number(config?.maxWorkers);
    const backlogThreshold = Number(config?.backlogThreshold);
    if (![1, 2].includes(maxWorkers) || !Number.isInteger(backlogThreshold) || backlogThreshold < 1 || backlogThreshold > 1000) {
      throw new Error('maxWorkers must be 1 or 2; backlogThreshold must be between 1 and 1000');
    }
    await this.redisService.getClient().set('audio:worker:config', JSON.stringify({maxWorkers, backlogThreshold}));
    return this.workerConfig();
  }

  async queueMetrics() {
    if (this.configService.get<string>('AUDIO_QUEUE_BACKEND') !== 'rabbitmq') {
      return { backend: 'redis', waiting: await this.redisService.getClient().lLen(QUEUE_KEY) };
    }
    const broker = this.configService.get<string>('RABBIT_JOB_BROKER_URL') || 'http://job-broker:8020';
    const token = this.configService.get<string>('JOB_INTERNAL_TOKEN') || '';
    const response = await fetch(`${broker}/stats`, {
      headers: { 'x-internal-token': token }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Broker stats unavailable: ${response.status}`);
    return { backend: 'rabbitmq', ...(await response.json() as object) };
  }

  async status(jobId: string) {
    const job = await this.loadJob(jobId);
    if (!job) return null;
    return {
      id: job.id,
      name: job.name,
      state: job.state,
      progress: job.progress,
      result: job.result,
      failedReason: job.failedReason || '',
      timestamp: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }
}
