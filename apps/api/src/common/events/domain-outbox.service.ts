import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection, ClientSession } from 'mongoose';
import { randomUUID } from 'node:crypto';

export type DomainEventType = 'identity.user.created.v1' | 'assessment.exam.created.v1'
  | 'arena.match.finished.v1';

/** Transaction-aware outbox publisher. For strict atomicity, the caller MUST
 * persist the business record in the same MongoDB session and pass it here;
 * production transactions require a MongoDB replica set. Without a session the
 * caller gets an at-least-once, best-effort outbox and should reconcile gaps.
 */
@Injectable()
export class DomainOutboxService {
  private readonly logger = new Logger(DomainOutboxService.name);
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async enqueue(type: DomainEventType, aggregateId: string,
    payload: Record<string, unknown>, session?: ClientSession): Promise<string> {
    const eventId = randomUUID();
    if (!this.connection.db) throw new Error('MongoDB unavailable');
    await this.connection.db.collection('domain_outbox').insertOne({
      _id: eventId as any,
      eventId, type, aggregateId, payload,
      version: 1, source: process.env.SERVICE_ROLE || 'unset',
      occurredAt: new Date(), state: 'pending', attempts: 0,
    }, session ? { session } : {});
    return eventId;
  }
}
