import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { migrationsFor } from '../apps/api/src/postgres/migrations.ts';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const { Pool } = createRequire(new URL('../apps/api/package.json', import.meta.url))('pg');
const name = `vocalearn-arena-test-${randomUUID().slice(0, 8)}`;
const password = randomUUID();
function docker(args) {
  const result = spawnSync('docker', args, { cwd, windowsHide: true, encoding: 'utf8', env: { ...process.env, POSTGRES_PASSWORD: password } });
  if (result.status !== 0) throw new Error(result.stderr || 'Docker command failed');
  return result.stdout.trim();
}
let pool, started = false;
try {
  docker(['run','--rm','-d','--name',name,'-e','POSTGRES_PASSWORD','-e','POSTGRES_DB=arena_db','-p','127.0.0.1::5432','postgres:17-alpine']);
  started = true;
  const port = Number(docker(['port',name,'5432/tcp']).split(':').at(-1));
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/arena_db`;
  pool = new Pool({ connectionString: url });
  let ready = false;
  for (let i=0;i<60;i++) {
    try { await pool.query('SELECT 1'); ready=true; break; } catch { await delay(250); }
  }
  if (!ready) throw new Error('Test PostgreSQL did not become ready');
  for (const migration of await migrationsFor('arena')) await pool.query(migration.sql);
  console.log('Running Arena tests against a disposable PostgreSQL database');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../apps/api/node_modules/vitest/vitest.mjs', import.meta.url)),'run','src/modules/arena'], {
    cwd: fileURLToPath(new URL('../apps/api/', import.meta.url)), windowsHide: true, stdio: 'inherit', env: { ...process.env, ARENA_TEST_DATABASE_URL: url },
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (pool) await pool.end();
  if (started) docker(['stop',name]);
}
