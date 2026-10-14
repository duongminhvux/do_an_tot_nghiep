import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
  | { type: 'TOEIC_EXAM_BULK'; examId: string; parts?: number[] };

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
  ) {}

  async onModuleInit() {
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
    const redis = this.redisService.getClient();
    await redis.set(this.jobKey(job.id), JSON.stringify(job), { EX: JOB_TTL_SECONDS });
  }

  private async loadJob(id: string): Promise<StoredAudioJob | null> {
    const raw = await this.redisService.getClient().get(this.jobKey(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredAudioJob;
    } catch {
      return null;
    }
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
          let result: unknown;
          if (job.data.type === 'VOCAB_BULK') {
            result = await this.audioProcessing.generateVocabularyBatch(
              job.data.ids,
              job.data.accent,
              (progress) => this.updateProgress(job, progress),
            );
          } else {
            result = await this.audioProcessing.generateToeicExamBatch(
              job.data.examId,
              job.data.parts,
              (progress) => this.updateProgress(job, progress),
            );
          }
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
    await this.redisService.getClient().lPush(QUEUE_KEY, id);
    return { jobId: id };
  }

  enqueueVocabularyBulk(ids: string[], accent: 'us' | 'uk' | 'both') {
    return this.enqueue('vocab-bulk', { type: 'VOCAB_BULK', ids, accent });
  }

  enqueueToeicExam(examId: string, parts?: number[]) {
    return this.enqueue('toeic-exam-bulk', { type: 'TOEIC_EXAM_BULK', examId, parts });
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
