import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../components/assessment/pdf-ai-review-problems.ts', import.meta.url), 'utf8');
const shared = new URL('../../../packages/shared-types/src/assessment-import.mjs', import.meta.url).href;
const { outputText } = ts.transpileModule(source.replace('@repo/shared-types/assessment-import', shared), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
const { getPdfAiReviewProblems, getPdfAiGroupProblems } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const question = (order, content = 'Printed question') => ({ order, content, options: [...'ABCD'].map(key => ({ key, text: key })), correctAnswer: 'A', scriptPages: [1] });

test('missing script questions remain visible even when the LC booklet supplied text', () => {
  const result = { listeningScript: { missingQuestions: [57,81,88,94] }, parts: [{ part: 5, groups: [], questions: [57,81,88,94].map(n => question(n)) }] };
  const problems = getPdfAiReviewProblems(result);
  assert.deepEqual(problems.map(p => p.order), [57,81,88,94]);
  assert.ok(problems.every(p => !p.error && p.messages.some(m => m.includes('PDF script'))));
});

test('question errors update after edits and OCR conflicts stay warnings', () => {
  const part = { part: 5, groups: [], questions: [question(101, ''), question(102)] };
  const result = { parts: [part], sections: [{ conflicts: [102] }] };
  assert.equal(getPdfAiReviewProblems(result)[0].error, true);
  const edited = { ...part, questions: [question(101), question(102)] };
  const problems = getPdfAiReviewProblems(result, { 5: edited });
  assert.deepEqual(problems.map(p => [p.order, p.error]), [[102, false]]);
});

test('group errors are counted once per exercise and legacy jobs infer script gaps', () => {
  const result = { listeningScript: { questions: 0 }, parts: [{ part: 6, groups: [{ id:'g', passages:[{ id:'p', content:'' }] }], questions:[{...question(131), scriptPages:undefined, passageGroupTempId:'g', passageTempId:'p'}] }, { part:2, groups:[], questions:[{...question(7,''), scriptPages:undefined, options:[...'ABC'].map(key=>({key,text:''}))}] }] };
  const problems = getPdfAiReviewProblems(result);
  assert.equal(problems.find(p=>p.order===7).error,true);
  assert.equal(problems.some(p=>p.order===131),false);
  const groups = getPdfAiGroupProblems(result);
  assert.equal(groups.length,1);
  assert.deepEqual(groups[0].orders,[131]);
  assert.ok(groups[0].messages.some(m=>m.includes('Đoạn văn')));
});
