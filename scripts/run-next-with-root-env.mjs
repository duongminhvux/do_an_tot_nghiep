import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const rootEnvPath = path.join(rootDir, '.env');

// Load the single root .env for local development/builds. In Docker, .env is
// intentionally excluded from the build context and Compose/build args provide
// the environment instead.
if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

const nextBin = path.resolve(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [nextBin, ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
