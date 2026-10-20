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
  Questions.findOne = (filter) => query(() => filter?.order?.$in ? storedQuestions.find(q => filter.order.$in.includes(q.order)) || null : { order: 10 });
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

test('learning captures a successfully saved AI Part and preserves its PDF order', async () => {
  const { service, storedQuestions } = setup();
  const events = [];
  service.learning = { sourceJob: () => '11111111-1111-4111-8111-111111111111', enqueue: async event => { events.push(event); return { status: 'queued' }; } };
  const result = await service.importQuestions(id, { ...payload(), preserveSourceOrder: true, batchId: '11111111-1111-4111-8111-111111111111-p5' });
  assert.equal(result.learning.status, 'queued');
  assert.equal(storedQuestions[0].sourceOrder, 101);
  assert.equal(events.length, 1);
  assert.equal(events[0].after.questions[0].content, payload().questions[0].content);
});

test('learning capture failure does not roll back a successfully saved exam Part', async () => {
  const { service, storedQuestions, removed } = setup();
  service.learning = { sourceJob: () => '11111111-1111-4111-8111-111111111111', enqueue: async () => ({ status: 'failed', message: 'Dataset capture failed' }) };
  const result = await service.importQuestions(id, { ...payload(), preserveSourceOrder: true, batchId: '11111111-1111-4111-8111-111111111111-p5' });
  assert.equal(result.importedCount, 1);
  assert.equal(result.learning.status, 'failed');
  assert.equal(storedQuestions.length, 1);
  assert.equal(removed.length, 0);
});

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

test('audio-only Parts 1 and 2 save empty text while Reading still rejects it', async () => {
  for (const part of [1,2]) {
    const {service,storedQuestions}=setup();
    const q={order:part===1?1:7,content:'',imageUrl:part===1?'https://example.com/photo.jpg':'',correctAnswer:'B',options:[...(part===2?'ABC':'ABCD')].map(key=>({key,text:''}))};
    await service.importQuestions(id,{part,preserveSourceOrder:true,questions:[q]});
    assert.equal(storedQuestions.length,1);
    assert.equal(storedQuestions[0].content,'');
    assert.ok(storedQuestions[0].options.every(o=>o.text===''));
  }
  await assert.rejects(new Question({examId:id,section:'READING',part:5,content:'',correctAnswer:'A',options:[...'ABCD'].map(key=>({key,text:''}))}).validate());
  await assert.rejects(new Question({examId:id,section:'READING',part:5,content:'Printed question',correctAnswer:'A',options:[...'ABCD'].map(key=>({key,text:''}))}).validate());
});

test('query updates allow audio-only text for Parts 1/2 and reject it for Reading', async () => {
  const original=Question.collection.findOneAndUpdate;
  let writes=0;
  Question.collection.findOneAndUpdate=async (filter, update) => { writes++; return {_id:filter._id,...update.$set}; };
  try {
    for (const part of [1,2]) {
      await Question.findOneAndUpdate({_id:new mongoose.Types.ObjectId()},{$set:{part,content:'',options:[...(part===2?'ABC':'ABCD')].map(key=>({key,text:''}))}},{runValidators:true,new:true}).lean().exec();
    }
    assert.equal(writes,2);
    await assert.rejects(Question.findOneAndUpdate({_id:new mongoose.Types.ObjectId()},{$set:{part:5,content:'Printed question',options:[...'ABCD'].map(key=>({key,text:''}))}},{runValidators:true,new:true}).lean().exec());
    assert.equal(writes,2);
  } finally { Question.collection.findOneAndUpdate=original; }
});
test('new questions append after existing questions instead of reusing source numbers', async () => {
  const { service, storedQuestions } = setup();
  const result = await service.importQuestions(id, payload());
  assert.equal(result.importedCount, 1);
  assert.equal(storedQuestions[0].order, 11);
});

test('AI bundle retains source question numbers instead of changing 101 to 11', async () => {
  const { service, storedQuestions } = setup();
  await service.importQuestions(id, { ...payload(), preserveSourceOrder: true });
  assert.equal(storedQuestions[0].order, 101);
});

test('source-order mode rejects wrong Part numbers and collisions without overwriting', async () => {
  const { service, storedQuestions } = setup();
  const data = { ...payload(), preserveSourceOrder: true };
  data.questions[0].order = 131;
  await assert.rejects(service.importQuestions(id, data), /101.*130/);
  data.questions[0].order = 101;
  await service.importQuestions(id, data);
  await assert.rejects(service.importQuestions(id, data), /ghi đè/);
  assert.equal(storedQuestions.length, 1);
});

test('source-order batch retries remain idempotent', async () => {
  const { service, storedQuestions } = setup();
  const data = { ...payload(), preserveSourceOrder: true, batchId: 'source-batch-12345678' };
  await service.importQuestions(id, data);
  await service.importQuestions(id, data);
  assert.equal(storedQuestions.length, 1);
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
test('API verifies the Part matches the requested section', async () => {
  const service = new QuestionsService({}, {}, {});
  await assert.rejects(
    service.parseQuestions(id, { part: 7, section: 'LISTENING', rawText: '1. Test' }),
    /kỹ năng đã chọn/,
  );
});

test('API loads exam context and rejects a non-TOEIC exam', async () => {
  const service = new QuestionsService({}, {}, {}, undefined, undefined, {
    findById: () => query({ type: 'IELTS' }),
  });
  await assert.rejects(service.parseQuestions(id, { part: 7, rawText: '1. Test' }), /TOEIC/);
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

test('LC bundle Part 3 without audio is accepted (audio added later)', async () => {
  const { service, storedQuestions, groups } = setup();
  // Simulate bundle: Part 3 group with empty transcript placeholder, no audio yet.
  const data = {
    part: 3,
    preserveSourceOrder: true,
    passageGroups: [
      { tempId: 'lc-part-3-32', passages: [{ tempId: 'lc-part-3-32-transcript', type: 'TEXT', content: '' }] },
    ],
    questions: [32, 33, 34].map((order) => ({
      order,
      content: `Question ${order} stem`,
      correctAnswer: 'A',
      passageGroupTempId: 'lc-part-3-32',
      options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Option ${key}` })),
    })),
  };
  const result = await service.importQuestions(id, data);
  assert.equal(result.importedCount, 3);
  assert.equal(groups.length, 1);
  assert.equal(storedQuestions[0].order, 32);
});

test('Part 3/4 saves a shared graphic together with transcript and audio', async () => {
  for (const part of [3,4]) {
    const {service,passages,storedQuestions}=setup();
    const start=part===3?65:98;
    const result=await service.importQuestions(id,{part,preserveSourceOrder:true,
      passageGroups:[{tempId:'graphic-group',passages:[{tempId:'graphic-passage',type:'TEXT',content:'Woman: Original transcript.',imageUrl:'https://example.com/graphic.jpg',audioUrl:'https://example.com/audio.wav'}]}],
      questions:[start,start+1,start+2].map(order=>({order,content:'Look at the graphic.',correctAnswer:'B',passageGroupTempId:'graphic-group',options:[...'ABCD'].map(key=>({key,text:`Choice ${key}`}))}))});
    assert.equal(result.importedCount,3);
    assert.equal(passages[0].imageUrl,'https://example.com/graphic.jpg');
    assert.equal(passages[0].content,'Woman: Original transcript.');
    assert.equal(passages[0].audioUrl,'https://example.com/audio.wav');
    assert.ok(storedQuestions.every(q=>q.correctAnswer==='B'));
  }
});

test('LC bundle Part 1 slot without content or audio is accepted (media added later)', async () => {
  const { service, storedQuestions } = setup();
  const data = {
    part: 1,
    preserveSourceOrder: true,
    questions: [1, 2, 3, 4, 5, 6].map((order) => ({
      order,
      content: '',
      correctAnswer: 'A',
      imageUrl: `https://example.com/photo-${order}.jpg`,
      options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Option ${key}` })),
    })),
  };
  const result = await service.importQuestions(id, data);
  assert.equal(result.importedCount, 6);
  assert.equal(storedQuestions[0].order, 1);
});

test('Reading image stems save with editable options and reject missing question sources', async () => {
  for (const part of [6, 7]) {
    const { service, storedQuestions, passages } = setup();
    const data = {part, preserveSourceOrder: true, passageGroups: [{tempId: 'image-group', passages: [{tempId: 'image-passage', type: 'TEXT', content: '', imageUrl: 'https://example.com/passage.jpg'}]}], questions: [{order: part === 6 ? 131 : 161, content: '', imageUrl: 'https://example.com/stem.jpg', passageGroupTempId: 'image-group', correctAnswer: 'C', options: [...'ABCD'].map(key => ({key, text: `Choice ${key}`}))}]};
    const result = await service.importQuestions(id, data);
    assert.equal(result.importedCount, 1);
    assert.equal(storedQuestions[0].content, '');
    assert.equal(storedQuestions[0].imageUrl, data.questions[0].imageUrl);
    assert.equal(storedQuestions[0].correctAnswer, 'C');
    assert.equal(passages[0].imageUrl, 'https://example.com/passage.jpg');
    await assert.rejects(() => setup().service.importQuestions(id, {...data, questions: [{...data.questions[0], imageUrl: ''}]}));
    await assert.rejects(() => setup().service.importQuestions(id, {...data, questions: [{...data.questions[0], options: data.questions[0].options.map(o => ({...o, text: ''}))}]}));
  }
});
