import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');

/** Ordinary Compose stays CPU-only. This launcher opts each configured service into CUDA. */
export function buildPlan(env, { infra = false, cuda = false, services = [] } = {}) {
  const files = [infra ? 'compose.infra.yml' : 'docker-compose.yml'];
  const gpuServices = [];
  for (const [service, key, override] of [
    ['asr-service', 'ASR_DEVICE', 'compose.asr-cuda.yml'],
    ['tts-service', 'KOKORO_DEVICE', 'compose.tts-cuda.yml'],
  ]) {
    const device = (env[key] || 'cpu').trim().toLowerCase();
    if (!['cpu', 'cuda'].includes(device)) throw new Error(`${key} must be cpu or cuda`);
    if (device === 'cuda') {
      files.push(override);
      if (!services.length || services.includes(service)) gpuServices.push(service);
    }
  }
  if (cuda && files.length === 1) {
    throw new Error('Set ASR_DEVICE=cuda and/or KOKORO_DEVICE=cuda in root .env first');
  }
  if (gpuServices.includes('tts-service') && !/^cu\d{3}$/.test(env.TORCH_CUDA_VARIANT || 'cu126')) {
    throw new Error('TORCH_CUDA_VARIANT must use a CUDA wheel variant, for example cu126');
  }
  const compose = ['compose', ...files.flatMap(file => ['-f', file])];
  return { files, gpuServices, compose, up: [...compose, 'up', '-d', '--build', ...services] };
}

export function main(args = process.argv.slice(2)) {
  const flags = new Set(args.filter(arg => arg.startsWith('--')));
  for (const flag of flags) {
    if (!['--infra', '--cuda', '--dry-run', '--check'].includes(flag)) throw new Error(`Unknown option ${flag}`);
  }
  const services = args.filter(arg => !arg.startsWith('--'));
  if (services.some(service => !/^[a-z][a-z0-9-]*$/.test(service))) throw new Error('Invalid service name');
  const envFile = resolve(root, '.env');
  if (!existsSync(envFile)) throw new Error('Missing root .env; copy .env.example and configure it first');
  // Shell values override .env, matching Docker Compose. Never log secrets from either source.
  const settings = { ...parseEnv(readFileSync(envFile, 'utf8')), ...process.env };
  const plan = buildPlan(settings, { infra: flags.has('--infra'), cuda: flags.has('--cuda'), services });
  console.log(`[docker-up] CUDA services: ${plan.gpuServices.join(', ') || 'none (CPU)'}`);
  console.log(`[docker-up] docker ${plan.up.join(' ')}`);
  if (flags.has('--dry-run')) return;

  const run = command => {
    // Compose must expand its own .env references; do not copy raw .env into the shell.
    const result = spawnSync('docker', command, { cwd: root, env: process.env, stdio: 'inherit', shell: false });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Docker ${command[0]} failed (exit ${result.status})`);
  };
  run([...plan.compose, 'config', '--quiet']);
  if (plan.gpuServices.length) {
    // Probe the Docker GPU boundary before downloading CUDA/Torch packages.
    // This small Python base is also used by the CPU/TTS Dockerfiles and stays cached.
    try {
      run(['run', '--rm', '--gpus', 'all', '-e', 'NVIDIA_DRIVER_CAPABILITIES=compute,utility',
        '--entrypoint', 'nvidia-smi', 'python:3.11-slim-bookworm',
        '--query-gpu=name,driver_version', '--format=csv,noheader']);
    } catch (error) {
      throw new Error('Docker cannot access NVIDIA GPUs. Check the NVIDIA driver and Docker GPU support before building CUDA images.', { cause: error });
    }
  }
  if (!flags.has('--check')) run(plan.up);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) {
    console.error(`[docker-up] ${error.message}`);
    process.exitCode = 1;
  }
}
