import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const name = `vocalearn-worker-test-${randomUUID().slice(0, 8)}`;
const password = randomUUID();
function docker(args, options = {}) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', windowsHide: true, ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Docker failed');
  return result.stdout.trim();
}
let started = false;
try {
  docker(['run', '--rm', '-d', '--name', name, '-e', `POSTGRES_PASSWORD=${password}`, 'postgres:17-alpine']);
  started = true;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
    await setTimeout(250);
  }
  if (!ready) throw new Error('Temporary PostgreSQL did not start');
  const migrations = ['media-jobs', 'common'].flatMap(owner => {
    const directory = resolve(root, 'database/postgres/migrations', owner);
    return readdirSync(directory).filter(file => file.endsWith('.sql')).map(file => ({ file, path: resolve(directory, file) }));
  }).sort((a, b) => a.file.localeCompare(b.file));
  docker(['exec', '-i', name, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], {
    input: migrations.map(migration => readFileSync(migration.path, 'utf8')).join('\n'), maxBuffer: 4 * 1024 * 1024,
  });
  console.log(docker(['run', '--rm', '--network', `container:${name}`,
    '--mount', `type=bind,source=${root},target=/workspace,readonly`, '-w', '/workspace',
    '-e', 'PGHOST=127.0.0.1', '-e', 'PGDATABASE=postgres', '-e', 'PGUSER=postgres', '-e', `PGPASSWORD=${password}`,
    '--entrypoint', 'python', process.env.WORKER_TEST_IMAGE || 'vocalearn-clean-asr-jobs:local', 'tests/worker-postgres.py'], { stdio: ['ignore', 'pipe', 'pipe'] }));
  console.log('Worker PostgreSQL 17 tests PASS');
} finally {
  if (started) docker(['stop', name]);
}
