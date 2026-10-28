import { Injectable } from '@nestjs/common';
import { InjectPgConnection, type PgConnection } from '../../../postgres/connection.js';
import { withMatchTransaction } from '../../../postgres/session.js';
@Injectable()
export class ArenaMatchTransactions {
  constructor(@InjectPgConnection() private readonly connection: PgConnection) {}
  run<T>(matchId: string, work: () => Promise<T>) {
    return withMatchTransaction(this.connection.pool, matchId, work);
  }
}
