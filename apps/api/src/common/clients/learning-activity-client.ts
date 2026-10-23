import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  LearningActivityWriter,
  RecordActivityInput,
} from '../../modules/learning-activity/learning-activity.service.js';

/**
 * Cross-service recorder. Only the Learning process writes learning_db;
 * all other business roles call its token-protected internal endpoint.
 * Failures are visible in logs and do not roll back a completed exam/game.
 * This is best-effort, not a durable outbox; see audit report.
 */
@Injectable()
export class LearningActivityClient implements LearningActivityWriter {
  private readonly logger = new Logger(LearningActivityClient.name);
  constructor(private readonly config: ConfigService) {}

  async record(input: RecordActivityInput): Promise<boolean> {
    const token = this.config.get<string>('INTERNAL_SERVICE_TOKEN') || '';
    if (token.length < 24) {
      this.logger.warn('XP event not delivered: INTERNAL_SERVICE_TOKEN is missing');
      return false;
    }
    const base = (this.config.get<string>('LEARNING_INTERNAL_URL') ||
      'http://learning-service:5000').replace(/\/$/, '');
    try {
      const response = await fetch(`${base}/api/_internal/learning/activity`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-token': token },
        body: JSON.stringify({ ...input, userId: String(input.userId) }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as {
        data?: { created?: boolean }; created?: boolean;
      };
      return Boolean(json?.data?.created ?? json?.created);
    } catch (error) {
      this.logger.warn(`XP event not delivered (${input.sourceKey}): ${String(error)}`);
      return false;
    }
  }
}

@Global()
@Module({ providers: [LearningActivityClient], exports: [LearningActivityClient] })
export class LearningActivityClientModule {}
