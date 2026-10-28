import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectPgConnection,withPgTransaction,type ClientSession,type PgConnection } from '../../postgres/connection.js';
export type DomainEventType='identity.user.created.v1'|'assessment.exam.created.v1'|'arena.match.finished.v1'|'learning.activity.recorded.v1'|'identity.user.updated.v1';
/** Prefer passing a caller-owned pg transaction client to make write + event atomic. */
@Injectable()
export class DomainOutboxService {
  constructor(@InjectPgConnection() private readonly connection:PgConnection){}

  /** State change and outbox insert share the same PostgreSQL connection.
   * A publish failure later is handled by the outbox relay, not by the caller. */
  async withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    return withPgTransaction(this.connection,transaction=>work({client:transaction.pool as unknown as NonNullable<ClientSession['client']>}));
  }
  async enqueue(type:DomainEventType,aggregateId:string,payload:Record<string,unknown>,session?:ClientSession){
    const eventId=randomUUID(), client=session?.client||this.connection;
    await client.query(`INSERT INTO public.outbox_events
      (event_id,event_type,aggregate_type,aggregate_id,payload)
      VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [eventId,type,type.split('.')[0],aggregateId,JSON.stringify(payload)]);
    return eventId;
  }
}
