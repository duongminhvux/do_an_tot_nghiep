import process from 'node:process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
const require = createRequire(resolve(root, 'apps/api/package.json'));
const { Pool } = require('pg');
const compiled = resolve(root, 'apps/api/dist/postgres/migrations.js');
const source = resolve(root, 'apps/api/src/postgres/migrations.ts');
const { migrate, DATABASES } = await import(pathToFileURL(process.env.NODE_ENV === 'production' && existsSync(compiled) ? compiled : source).href);
const selected = process.argv.includes('--all') ? Object.keys(DATABASES) : [process.env.SERVICE_ROLE];
const status = process.argv.includes('--status');
for (const role of selected) {
  if (!role || !DATABASES[role]) throw new Error('Choose --all or set a valid SERVICE_ROLE');
  const owner = role === 'media-jobs' ? 'media' : role.replaceAll('-', '_');
  const pool = new Pool({ host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5432),
    database: DATABASES[role], user: `vl_${owner}`,
    password: process.env[`PG_${owner.toUpperCase()}_PASSWORD`] || process.env.PGPASSWORD,
    connectionTimeoutMillis: 10000 });
  try {
    const result = await migrate(pool, role, !status);
    console.log(JSON.stringify(result));
    if (status && !result.ready) process.exitCode = 1;
  } finally { await pool.end(); }
}
