import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../lib/draft-uploads.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { DraftUploads } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function setup() {
  const deleted = [];
  return { deleted, draft: new DraftUploads(async (url, keepalive) => deleted.push({ url, keepalive })) };
}

test('removing/replacing an uploaded image deletes it, pasted URLs stay untouched', () => {
  const { draft, deleted } = setup();
  draft.track('uploaded');
  draft.setUrls(['uploaded', 'pasted']);
  assert.equal(deleted.length, 0);
  draft.track('replacement');
  draft.setUrls(['replacement']);
  assert.deepEqual(deleted, [{ url: 'uploaded', keepalive: false }]);
  draft.setUrls([]);
  assert.deepEqual(deleted.map((item) => item.url), ['uploaded', 'replacement']);
});

test('leaving a draft cleans every unsaved asset but preserves saved images', () => {
  const { draft, deleted } = setup();
  draft.track('saved');
  draft.track('unsaved');
  draft.commit(['saved']);
  draft.unmount();
  assert.deepEqual(deleted, [{ url: 'unsaved', keepalive: true }]);
});

test('leaving while saving defers cleanup and preserves successfully saved assets', () => {
  const { draft, deleted } = setup();
  draft.track('saved');
  draft.track('unused');
  draft.startSaving();
  draft.unmount();
  assert.equal(deleted.length, 0);
  draft.commit(['saved']);
  draft.finishSaving();
  assert.deepEqual(deleted, [{ url: 'unused', keepalive: true }]);
});

test('failed save retains images for retry while form is open', () => {
  const { draft, deleted } = setup();
  draft.track('image');
  draft.setUrls(['image']);
  draft.startSaving();
  draft.finishSaving();
  assert.equal(deleted.length, 0);
  draft.unmount();
  assert.equal(deleted[0].url, 'image');
});

test('uploads completing after navigation are deleted immediately', () => {
  const { draft, deleted } = setup();
  draft.unmount();
  assert.equal(draft.track('late'), false);
  assert.equal(deleted[0].url, 'late');
});
