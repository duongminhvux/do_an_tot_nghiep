import pg from 'pg';
import { Global, Inject, Module, type DynamicModule } from '@nestjs/common';
import { currentPgSession, sessionPool } from './session.js';

export type PgConnection = {
  pool: pg.Pool;
  query: (sql: string, params?: any[]) => Promise<pg.QueryResult>;
};
export type ClientSession = { client?: pg.PoolClient };

let defaultPool: pg.Pool | null = null;
export const getConnectionToken = () => 'PG_CONNECTION';
export const InjectPgConnection = (): ParameterDecorator =>
  Inject(getConnectionToken());
export const getDb = () => defaultPool;
export function createConnection(pool: pg.Pool): PgConnection {
  const executor = sessionPool(pool);
  return { pool, query: (sql, params) => executor.query(sql, params) };
}

export async function withPgTransaction<T>(
  connection: PgConnection,
  work: (transaction: PgConnection) => Promise<T>,
): Promise<T> {
  const active = currentPgSession(connection.pool);
  if (active) return work(createConnection(active as unknown as pg.Pool));
  // A transaction connection supplied by a caller must not start/commit a nested transaction.
  if (
    typeof (connection.pool as unknown as pg.PoolClient).release === 'function'
  )
    return work(connection);
  const client = await connection.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(createConnection(client as unknown as pg.Pool));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

@Global()
@Module({})
export class PgDatabaseModule {
  static forRootAsync(): DynamicModule {
    return {
      module: PgDatabaseModule,
      global: true,
      providers: [
        {
          provide: getConnectionToken(),
          useFactory: () => {
            if (!defaultPool) {
              const config = process.env.DATABASE_URL
                ? { connectionString: process.env.DATABASE_URL }
                : {
                    host: process.env.PGHOST || '127.0.0.1',
                    port: Number(process.env.PGPORT || 5432),
                    database: process.env.PGDATABASE,
                    user: process.env.PGUSER,
                    password: process.env.PGPASSWORD,
                  };
              if (
                !process.env.DATABASE_URL &&
                (!config.database || !config.user || !config.password)
              )
                throw new Error(
                  'PostgreSQL role/database credentials must be provided',
                );
              defaultPool = new pg.Pool({
                ...config,
                max: Number(process.env.PG_POOL_MAX || 8),
                connectionTimeoutMillis: 10000,
              });
            }
            return createConnection(defaultPool);
          },
        },
      ],
      exports: [getConnectionToken()],
    };
  }
}
