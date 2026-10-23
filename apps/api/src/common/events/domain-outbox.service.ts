import {Injectable} from '@nestjs/common';
import {InjectPgConnection,type PgConnection,type ClientSession} from '../../postgres/compat.js';
import {randomUUID} from 'node:crypto';
export type DomainEventType='identity.user.created.v1'|'assessment.exam.created.v1'|'arena.match.finished.v1';
/** Prefer passing a caller-owned pg transaction client to make write + event atomic. */
@Injectable()
export class DomainOutboxService {
  constructor(@InjectPgConnection() private readonly connection:PgConnection){}
  async enqueue(type:DomainEventType,aggregateId:string,payload:Record<string,unknown>,session?:ClientSession){
    const eventId=randomUUID(), client=session?.client||this.connection;
    await client.query(`INSERT INTO public.outbox_events
      (event_id,event_type,aggregate_type,aggregate_id,payload)
      VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [eventId,type,type.split('.')[0],aggregateId,JSON.stringify(payload)]);
    return eventId;
  }
}
