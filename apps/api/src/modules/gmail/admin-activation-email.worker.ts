import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  InjectPgConnection,
  type PgConnection,
} from '../../postgres/connection.js';

/** Notification-owned leased sender. Job contains only IDs, never a bearer token/link. */
@Injectable()
export class AdminActivationEmailWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(
    @InjectPgConnection() private readonly connection: PgConnection,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (
      this.config.get<string>('ADMIN_ACTIVATION_EMAIL_WORKER_ENABLED') ===
      'true'
    ) {
      this.timer = setInterval(() => {
        if (!this.busy) {
          this.busy = true;
          void this.runOnce()
            .catch(() => {})
            .finally(() => {
              this.busy = false;
            });
        }
      }, 1000);
      this.timer.unref();
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async runOnce() {
    if (
      this.config.get<string>('ADMIN_ACTIVATION_EMAIL_WORKER_ENABLED') !==
      'true'
    )
      return false;
    const owner = randomUUID();
    const {
      rows: [job],
    } = await this.connection.query(
      `WITH due AS (
      SELECT id FROM public.notification_email_jobs WHERE subject='ADMIN_ACTIVATION_V1'
      AND ((state='pending' AND next_attempt_at<=clock_timestamp()) OR (state='active' AND lease_until<=clock_timestamp()))
      ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE public.notification_email_jobs j SET state='active',lease_owner=$1,lease_until=clock_timestamp()+interval '45 seconds',attempts=attempts+1
      FROM due WHERE j.id=due.id RETURNING j.*`,
      [owner],
    );
    if (!job) return false;
    const finish = async (state: string, error: string | null) =>
      this.connection.query(
        `UPDATE public.notification_email_jobs SET state=$3,last_error=$4,
      lease_owner=NULL,lease_until=NULL,completed_at=CASE WHEN $3 IN ('completed','dead') THEN clock_timestamp() ELSE NULL END,
      html=CASE WHEN $3 IN ('completed','dead') THEN '{}' ELSE html END,
      next_attempt_at=clock_timestamp()+make_interval(secs=>$5)
      WHERE id=$1 AND lease_owner=$2 AND state='active'`,
        [
          job.id,
          owner,
          state,
          error,
          Math.min(900, 2 ** Math.min(job.attempts, 10)),
        ],
      );
    try {
      if (job.attempts > 6) {
        await finish('dead', 'RETRY_EXHAUSTED');
        return true;
      }
      const descriptor = JSON.parse(job.html),
        tokenId = descriptor.tokenId;
      if (typeof tokenId !== 'string' || !/^[0-9a-f-]{36}$/.test(tokenId))
        throw Error('Invalid job');
      const secret = this.config.get<string>('INTERNAL_SERVICE_TOKEN') || '';
      if (secret.length < 24) throw Error('Missing internal auth');
      const base =
        this.config.get<string>('IDENTITY_INTERNAL_URL') ||
        'http://identity-service:5000';
      const response = await fetch(
        base + '/api/_internal/identity/admin-activation/deliver',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-token': secret,
          },
          body: JSON.stringify({ tokenId }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw Error('Delivery unavailable');
      const json = (await response.json()) as any,
        result = json.data ?? json;
      if (result.delivery === 'CANCELLED')
        await finish('dead', 'INVITATION_UNAVAILABLE');
      else if (result.delivery === 'SENT') await finish('completed', null);
      else throw Error('Invalid delivery response');
    } catch {
      await finish(
        job.attempts >= 6 ? 'dead' : 'pending',
        job.attempts >= 6 ? 'RETRY_EXHAUSTED' : 'DELIVERY_UNAVAILABLE',
      );
    }
    return true;
  }
}
