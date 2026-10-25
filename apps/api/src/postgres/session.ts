import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient } from 'pg';

const sessions = new AsyncLocalStorage<{ pool: Pool; client: PoolClient; matchId: string }>();
export function currentPgSession(pool: Pool) {
  const session = sessions.getStore();
  return session?.pool === pool ? session.client : undefined;
}
// Bind existing repositories and the transactional outbox to one connection.
export function sessionPool(pool: Pool): Pool {
  return new Proxy(pool, { get(target, key) {
    const source = currentPgSession(target) ?? target;
    const value = Reflect.get(source, key, source);
    return typeof value === 'function' ? value.bind(source) : value;
  } });
}
export async function withMatchTransaction<T>(pool: Pool, matchId: string, work: () => Promise<T>): Promise<T> {
  const active = sessions.getStore();
  if (active?.pool === pool) {
    if (active.matchId !== matchId) throw new Error('Cannot lock a second match in the same transaction');
    return work();
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`arena:ranked:${matchId}`]);
    const result = await sessions.run({ pool, client, matchId }, work);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
