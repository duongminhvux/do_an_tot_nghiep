import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { checkRelations } from './lib/postgres-relations.mjs';

const root = resolve(import.meta.dirname, '..');
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
const { Pool } = createRequire(resolve(root, 'apps/api/package.json'))('pg');
const selected = process.argv.includes('--all') ? ['content', 'learning'] : [process.env.SERVICE_ROLE];
for (const owner of selected) {
  if (!['content', 'learning'].includes(owner)) throw new Error('Set SERVICE_ROLE=content|learning or use --all');
  const pool = new Pool({ host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5432),
    database: `${owner}_db`, user: `vl_${owner}`, password: process.env[`PG_${owner.toUpperCase()}_PASSWORD`] || process.env.PGPASSWORD,
    connectionTimeoutMillis: 10000 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL statement_timeout='30s'");
      const relations = await checkRelations(client, owner);
      await client.query('COMMIT');
      console.log(JSON.stringify({ owner, ready: relations.every(row => row.orphanCount === '0'), relations }, null, 2));
      if (relations.some(row => row.orphanCount !== '0')) process.exitCode = 1;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } finally { await pool.end(); }
}
