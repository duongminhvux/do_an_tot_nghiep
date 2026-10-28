import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile,readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool,PoolClient } from 'pg';

export const DATABASES: Record<string, string> = {
  identity: 'identity_db', content: 'content_db', assessment: 'assessment_db', arena: 'arena_db',
  learning: 'learning_db', 'media-jobs': 'media_db', 'ai-import': 'ai_import_db', notification: 'notification_db',
};
export function migrationDirectory(): string {
  const paths = [resolve(process.cwd(), 'database/postgres/migrations'), resolve(process.cwd(), '../../database/postgres/migrations')];
  const path = paths.find(existsSync);
  if (!path) throw new Error('Versioned PostgreSQL migrations are missing from the artifact');
  return path;
}
export interface Migration { version: string; checksum: string; sql: string }
interface SchemaContract { version: string; migrationsChecksum: string; fingerprint: string }
export function migrationSetChecksum(migrations: readonly Migration[]): string {
  return createHash('sha256').update(JSON.stringify(migrations.map(({version,checksum})=>({version,checksum})))).digest('hex');
}
async function expectedSchema(role: string, migrations: readonly Migration[]): Promise<SchemaContract> {
  const contracts: Record<string, SchemaContract> = JSON.parse(await readFile(resolve(migrationDirectory(),'contracts.json'),'utf8'));
  const contract=contracts[role];
  if(!contract || contract.version!==migrations.at(-1)?.version || contract.migrationsChecksum!==migrationSetChecksum(migrations)
    || !/^[a-f0-9]{64}$/.test(contract.fingerprint)) throw new Error(`Schema reference is missing or stale for ${role}; rebuild it from a fresh reference database`);
  return contract;
}
export async function migrationsFor(role: string): Promise<Migration[]> {
  if (!(role in DATABASES)) throw new Error('Unknown migration owner');
  const root = migrationDirectory(), files: { version: string; path: string }[] = [];
  for (const scope of ['common', role]) {
    for (const file of await readdir(resolve(root, scope))) {
      if (/^\d{4}_[a-z_0-9]+\.sql$/.test(file)) files.push({ version: file.replace(/\.sql$/, ''), path: resolve(root, scope, file) });
    }
  }
  files.sort((a, b) => a.version.localeCompare(b.version));
  if (new Set(files.map(file => file.version)).size !== files.length) throw new Error('Duplicate migration version');
  return Promise.all(files.map(async file => {
    const sql = (await readFile(file.path, 'utf8')).replace(/\r\n/g, '\n');
    return { version: file.version, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}

/** Fingerprint database structure, not business row contents. */
export async function schemaFingerprint(client: Pick<PoolClient, 'query'>): Promise<string> {
  const { rows } = await client.query<{ definition: string }>(`
    SELECT definition FROM (
      SELECT 'column:'||c.relname||':'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull||':'||COALESCE(pg_get_expr(d.adbin,d.adrelid),'') definition
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped AND c.relname<>'schema_migrations'
      UNION ALL SELECT 'index:'||indexname||':'||indexdef FROM pg_indexes WHERE schemaname='public' AND tablename<>'schema_migrations'
      UNION ALL SELECT 'constraint:'||c.relname||':'||con.conname||':'||pg_get_constraintdef(con.oid)
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname<>'schema_migrations'
      UNION ALL SELECT 'trigger:'||pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    ) definitions ORDER BY definition`);
  return createHash('sha256').update(JSON.stringify(rows.map(row => row.definition))).digest('hex');
}

export async function migrate(pool: Pool, role: string, apply = true) {
  const migrations = await migrationsFor(role), contract=await expectedSchema(role,migrations), client = await pool.connect();
  let inTransaction=false;
  try {
    const owner = await client.query<{ name: string }>('SELECT current_database() AS name');
    if (owner.rows[0].name !== DATABASES[role]) throw new Error(`Migration owner/database mismatch for ${role}`);
    await client.query("SELECT pg_advisory_lock(hashtextextended('vocalearn.schema',0))");
    const exists=await client.query<{exists:boolean}>("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists");
    const history=exists.rows[0].exists
      ? await client.query<{ version: string; checksum: string; fingerprint: string }>('SELECT version,checksum,fingerprint FROM public.schema_migrations ORDER BY version')
      : {rows:[]};
    for (const row of history.rows) {
      const migration = migrations.find(item => item.version === row.version);
      if (!migration || migration.checksum !== row.checksum) throw new Error(`Migration checksum mismatch: ${row.version}`);
    }
    const last = history.rows.at(-1);
    if(history.rows.some((row,index)=>row.version!==migrations[index]?.version))throw new Error('Migration history has a gap or an out-of-order version');
    if (last && last.fingerprint !== await schemaFingerprint(client)) throw new Error('PostgreSQL schema drift detected; use a reviewed forward migration');
    const pending = migrations.filter(item => !history.rows.some(row => row.version === item.version));
    if (last && pending.some(item => item.version < last.version)) throw new Error('Out-of-order migration detected');
    if(!pending.length && await schemaFingerprint(client)!==contract.fingerprint) throw new Error('PostgreSQL schema differs from the canonical migration reference');
    if (!apply) return { role, current: last?.version || null, required: migrations.at(-1)?.version, pending: pending.map(item => item.version), ready: pending.length === 0 };
    if(pending.length){
      // The whole owner upgrade rolls back if adoption does not reach the canonical
      // schema. Never record a divergent legacy database as the accepted baseline.
      await client.query('BEGIN');inTransaction=true;
      await client.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s'");
      await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version text PRIMARY KEY, checksum text NOT NULL, fingerprint text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now())`);
    for (const migration of pending) {
        await client.query(migration.sql);
        const fingerprint = await schemaFingerprint(client);
        await client.query('INSERT INTO public.schema_migrations(version,checksum,fingerprint) VALUES($1,$2,$3)', [migration.version, migration.checksum, fingerprint]);
    }
      if(await schemaFingerprint(client)!==contract.fingerprint)throw new Error('PostgreSQL schema differs from the canonical migration reference; adoption was rolled back');
      await client.query('COMMIT');inTransaction=false;
    }
    return { role, current: migrations.at(-1)?.version, required: migrations.at(-1)?.version, pending: [], ready: true };
  } catch(error){
    if(inTransaction)await client.query('ROLLBACK');
    throw error;
  } finally {
    try { await client.query("SELECT pg_advisory_unlock(hashtextextended('vocalearn.schema',0))"); } finally { client.release(); }
  }
}

export async function assertSchemaReady(pool: Pool, role: string): Promise<void> {
  const status = await migrate(pool, role, false);
  if (!status.ready) throw new Error(`Pending migrations for ${role}: ${status.pending.join(',')}`);
}
