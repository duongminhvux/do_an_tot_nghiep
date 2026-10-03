import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { QuestionsService } from '../dist/modules/assessment/questions/questions.service.js';
import { QuestionSchema } from '../dist/modules/assessment/questions/schemas/question.schema.js';

const id = new mongoose.Types.ObjectId().toString();
const Question = mongoose.model('ImportWorkflowQuestion', QuestionSchema);
const query = (fn) => ({
  sort() {
    return this;
  },
  select() {
    return this;
  },
  lean() {
    return this;
  },
  async exec() {
    return typeof fn === 'function' ? fn() : fn;
  },
});
const payload = (part = 5) => ({
  part,
  questions: [
    {
      order: 101,
      content: 'The meeting is on Friday.',
      correctAnswer: 'A',
      options: ['A', 'B', 'C', 'D'].map((key) => ({
        key,
        text: `Option ${key}`,
      })),
    },
  ],
});

function setup({ failPassage = false, failQuestions = false } = {}) {
  const storedQuestions = [],
    groups = [],
    passages = [],
    removed = [];
  class Questions extends Question {}
  Questions.findOne = () => query({ order: 10 });
  Questions.find = (filter) =>
    query(() =>
      storedQuestions.filter((q) => q.importBatchId === filter.importBatchId),
    );
  Questions.insertMany = async (docs) => {
    storedQuestions.push(...docs);
    if (failQuestions) throw new Error('Question write failed');
    return docs;
  };
  Questions.deleteMany = (filter) =>
    query(() => {
      removed.push(filter);
      const ids = filter._id.$in.map(String);
      for (let i = storedQuestions.length - 1; i >= 0; i--)
        if (ids.includes(String(storedQuestions[i]._id)))
          storedQuestions.splice(i, 1);
    });
  const groupModel = {
    findOne: () => query({ order: 3 }),
    create: async (g) => {
      groups.push(g);
      return g;
    },
    deleteMany: (filter) =>
      query(() => {
        removed.push(filter);
        groups.length = 0;
      }),
  };
  const passageModel = {
    create: async (p) => {
      if (failPassage) throw new Error('Passage write failed');
      passages.push(p);
      return p;
    },
    deleteMany: (filter) =>
      query(() => {
        removed.push(filter);
        passages.length = 0;
      }),
  };
  return {
    service: new QuestionsService(Questions, groupModel, passageModel),
    storedQuestions,
    groups,
    passages,
    removed,
  };
}

test('invalid question is rejected before writing any group or question', async () => {
  const { service, groups, storedQuestions } = setup();
  const data = payload();
  data.questions[0].correctAnswer = '';
  await assert.rejects(service.importQuestions(id, data), (error) =>
    error
      .getResponse()
      .message.some((message) => message.includes('đáp án đúng')),
  );
  assert.equal(groups.length, 0);
  assert.equal(storedQuestions.length, 0);
});
test('new questions append after existing questions instead of reusing source numbers', async () => {
  const { service, storedQuestions } = setup();
  const result = await service.importQuestions(id, payload());
  assert.equal(result.importedCount, 1);
  assert.equal(storedQuestions[0].order, 11);
});
test('same batch retried after a lost response returns the saved batch without duplicates', async () => {
  const { service, storedQuestions } = setup();
  const data = { ...payload(), batchId: 'test-batch-1234567890' };
  await service.importQuestions(id, data);
  await service.importQuestions(id, data);
  assert.equal(storedQuestions.length, 1);
  data.questions[0].content = 'Changed content';
  await assert.rejects(service.importQuestions(id, data), /dữ liệu khác/);
});
test('failed question insert cleans request-owned questions, passages and groups', async () => {
  const { service, storedQuestions, groups, passages, removed } = setup({
    failQuestions: true,
  });
  const data = payload(7);
  data.passageGroups = [
    { tempId: 'g1', passages: [{ tempId: 'p1', content: 'A passage.' }] },
  ];
  data.questions[0].passageGroupTempId = 'g1';
  await assert.rejects(
    service.importQuestions(id, data),
    /Question write failed/,
  );
  assert.equal(storedQuestions.length, 0);
  assert.equal(groups.length, 0);
  assert.equal(passages.length, 0);
  assert.equal(removed.length, 3);
  assert.ok(
    removed.every((filter) => filter._id?.$in || filter.passageGroupId?.$in),
  );
});
test('failed passage insert also removes the allocated group', async () => {
  const { service, groups } = setup({ failPassage: true });
  const data = payload(7);
  data.passageGroups = [
    { tempId: 'g1', passages: [{ tempId: 'p1', content: 'A passage.' }] },
  ];
  data.questions[0].passageGroupTempId = 'g1';
  await assert.rejects(
    service.importQuestions(id, data),
    /Passage write failed/,
  );
  assert.equal(groups.length, 0);
});
test('API verifies the Part belongs to the exam section', async () => {
  const service = new QuestionsService({}, {}, {}, undefined, {
    findById: () => query({ type: 'TOEIC', section: 'LISTENING' }),
  });
  await assert.rejects(
    service.parseQuestions(id, { part: 7, rawText: '1. Test' }),
    /kỹ năng của đề/,
  );
});
test('TXT extraction matches the pasted-text parser and .doc is explicitly rejected', async () => {
  const service = new QuestionsService({}, {}, {});
  const source =
    '101. What day?\nA. Friday\nB. Monday\nC. Sunday\nD. Tuesday\nAnswer: A';
  const text = await service.extractTextFromFile({
    originalname: 'questions.txt',
    buffer: Buffer.from(source),
  });
  const pasted = await service.parseQuestions(id, { part: 5, rawText: source });
  const uploaded = await service.parseQuestions(
    id,
    { part: 5 },
    { originalname: 'questions.txt', buffer: Buffer.from(source) },
  );
  assert.equal(text, source);
  assert.deepEqual(uploaded.questions, pasted.questions);
  await assert.rejects(
    service.extractTextFromFile({
      originalname: 'questions.doc',
      buffer: Buffer.from(source),
    }),
    /chuyển .doc/,
  );
});
test('Word extraction produces real text from the officeparser AST', async () => {
  const service = new QuestionsService({}, {}, {});
  const buffer = await readFile(
    new URL('./fixtures/import-sample.docx', import.meta.url),
  );
  const text = await service.extractTextFromFile({
    originalname: 'questions.docx',
    buffer,
  });
  assert.ok(text.includes('101. What day?'));
  const draft = service.parseQuestionText(text, 5);
  assert.equal(draft.questions.length, 1);
  assert.equal(draft.questions[0].correctAnswer, 'A');
});

test('PDF with selectable text parses the same question and answer', async () => {
  const service = new QuestionsService({}, {}, {});
  const buffer = await readFile(
    new URL('./fixtures/import-sample.pdf', import.meta.url),
  );
  const result = await service.parseQuestions(
    id,
    { part: 5 },
    { originalname: 'questions.pdf', buffer },
  );
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].correctAnswer, 'A');
  assert.equal(result.questions[0].options.length, 4);
});
