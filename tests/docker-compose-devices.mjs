import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
for (const base of ['docker-compose.yml', 'compose.infra.yml']) {
  for (const [name, overrides, cudaServices] of [
    ['CPU despite CUDA env', [], []],
    ['ASR CUDA', ['compose.asr-cuda.yml'], ['asr-service']],
    ['TTS CUDA', ['compose.tts-cuda.yml'], ['tts-service']],
    ['both CUDA', ['compose.asr-cuda.yml', 'compose.tts-cuda.yml'], ['asr-service', 'tts-service']],
  ]) {
    test(`${base}: ${name}`, () => {
      const result = spawnSync('docker', ['compose', ...[base, ...overrides].flatMap(file => ['-f', file]), 'config', '--format', 'json'], {
        cwd: root,
        env: { ...process.env, ASR_DEVICE: 'cuda', KOKORO_DEVICE: 'cuda', ASR_COMPUTE_TYPE: 'float16', TORCH_CUDA_VARIANT: 'cu126' },
        encoding: 'utf8',
      });
      // Do not print the resolved Compose document: it contains application secrets.
      assert.equal(result.status, 0, result.stderr);
      const { services } = JSON.parse(result.stdout);
      for (const [service, variable] of [['asr-service', 'ASR_DEVICE'], ['tts-service', 'KOKORO_DEVICE']]) {
        const cuda = cudaServices.includes(service);
        assert.equal(services[service].environment[variable], cuda ? 'cuda' : 'cpu');
        const devices = services[service].deploy?.resources?.reservations?.devices || [];
        assert.equal(devices.length, cuda ? 1 : 0);
        if (cuda) assert.deepEqual(devices[0].capabilities, ['gpu']);
      }
      assert.equal(services['asr-service'].build.dockerfile, cudaServices.includes('asr-service') ? 'services/asr-service/Dockerfile.gpu' : 'services/asr-service/Dockerfile');
      assert.equal(services['asr-service'].environment.ASR_COMPUTE_TYPE, cudaServices.includes('asr-service') ? 'float16' : 'int8');
      assert.equal(services['tts-service'].build.args.TORCH_VARIANT, cudaServices.includes('tts-service') ? 'cu126' : 'cpu');
    });
  }
}
