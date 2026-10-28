import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlan } from '../scripts/docker-up.mjs';

test('default environment keeps the ordinary CPU compose file', () => {
  const plan = buildPlan({});
  assert.deepEqual(plan.files, ['docker-compose.yml']);
  assert.deepEqual(plan.gpuServices, []);
  assert.deepEqual(plan.up, ['compose', '-f', 'docker-compose.yml', 'up', '-d', '--build']);
});

test('opts only ASR into CUDA and preserves an explicit service selection', () => {
  const plan = buildPlan({ ASR_DEVICE: 'cuda', KOKORO_DEVICE: 'cpu' }, { services: ['asr-service'] });
  assert.deepEqual(plan.files, ['docker-compose.yml', 'compose.asr-cuda.yml']);
  assert.deepEqual(plan.gpuServices, ['asr-service']);
  assert.equal(plan.up.at(-1), 'asr-service');
});

test('opts only TTS into CUDA for the local infra stack', () => {
  const plan = buildPlan({ KOKORO_DEVICE: ' CUDA ' }, { infra: true, cuda: true });
  assert.deepEqual(plan.files, ['compose.infra.yml', 'compose.tts-cuda.yml']);
  assert.deepEqual(plan.gpuServices, ['tts-service']);
});

test('can enable both GPU services and skips the GPU probe for unrelated targets', () => {
  const env = { ASR_DEVICE: 'cuda', KOKORO_DEVICE: 'cuda' };
  assert.deepEqual(buildPlan(env).gpuServices, ['asr-service', 'tts-service']);
  assert.deepEqual(buildPlan(env, { services: ['postgres'] }).gpuServices, []);
});

test('rejects mistyped device and CPU wheels in a CUDA TTS build', () => {
  assert.throws(() => buildPlan({ ASR_DEVICE: 'cdua' }), /ASR_DEVICE/);
  assert.throws(() => buildPlan({}, { cuda: true }), /root .env/);
  assert.throws(() => buildPlan({ KOKORO_DEVICE: 'cuda', TORCH_CUDA_VARIANT: 'cpu' }), /TORCH_CUDA_VARIANT/);
});
