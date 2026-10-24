import { Global, Injectable, Module } from '@nestjs/common';
import { DomainOutboxService } from '../events/domain-outbox.service.js';
import { serviceRole } from '../../postgres/ownership.js';
import type {
  LearningActivityWriter,
  RecordActivityInput,
} from '../../modules/learning-activity/learning-activity.service.js';

/**
 * Durable cross-owner learning credit delivery.
 * Enqueuing commits to the current owner's PostgreSQL outbox. The owner relay
 * publishes to RabbitMQ and the Learning consumer writes its credit ledger
 * transactionally with the inbox. Never silently drop XP during an outage.
 */
@Injectable()
export class LearningActivityClient implements LearningActivityWriter {
  constructor(private readonly outbox: DomainOutboxService) {}

  async record(input: RecordActivityInput): Promise<boolean> {
    const owner = serviceRole();
    if (!owner) throw new Error('SERVICE_ROLE is required to record a learning credit');
    if (owner === 'learning') throw new Error('Use LearningActivityService directly inside learning-service');
    const userId = String(input.userId);
    if (!userId || !input.sourceKey || !Number.isFinite(input.xp)) {
      throw new Error('Invalid learning credit');
    }
    await this.outbox.enqueue('learning.activity.recorded.v1', userId, {
      ...input,
      userId,
      sourceService: owner,
      occurredAt: input.occurredAt?.toISOString() ?? new Date().toISOString(),
    });
    // true means DURABLY QUEUED, not that another service already processed it.
    return true;
  }
}

@Global()
@Module({ providers: [LearningActivityClient], exports: [LearningActivityClient] })
export class LearningActivityClientModule {}
