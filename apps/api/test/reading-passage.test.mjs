import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { QuestionsService } from '../dist/modules/assessment/questions/questions.service.js';

const id = new mongoose.Types.ObjectId().toString();
const query = (value) => ({ async exec() { return value; } });

for (const part of [6, 7]) {
  test(`Part ${part} rejects mixed or empty passages before creating a group`, async () => {
    const service = new QuestionsService({}, {}, {});
    for (const passage of [{ content: 'text', imageUrl: 'https://example.com/image.png' }, { content: '   ', imageUrl: '' }]) {
      await assert.rejects(service.createPassageGroup({ examId: id, part, passages: [passage] }), /either text or an image/);
    }
  });

  test(`Part ${part} allows separate text and image passages in the same group`, async () => {
    const saved = [];
    class Group { async save() { return { _id: id }; } }
    const service = new QuestionsService({}, Group, { async create(p) { saved.push(p); } });
    await service.createPassageGroup({ examId: id, part, passages: [
      { content: 'text' }, { imageUrl: 'https://example.com/image.png' },
    ] });
    assert.equal(saved.length, 2);
    assert.equal(saved[0].imageUrl, undefined);
    assert.equal(saved[1].content, undefined);
  });

  test(`Part ${part} validates the merged passage when updating only one field`, async () => {
    const service = new QuestionsService({}, { findById: () => query({ part }) }, {
      findById: () => query({ passageGroupId: id, toObject: () => ({ content: 'existing text' }) }),
    });
    await assert.rejects(service.updatePassage(id, { imageUrl: 'https://example.com/image.png' }), /either text or an image/);
    await assert.rejects(service.updatePassage(id, { content: '' }), /either text or an image/);
  });

  test(`Part ${part} rejects mixed content in group updates before writing`, async () => {
    const service = new QuestionsService({}, { findById: () => query({ part }) }, {
      find: () => ({ lean() { return this; }, async exec() { return [{ _id: id, content: 'existing text' }]; } }),
    });
    await assert.rejects(service.updatePassageGroup(id, {
      passages: [{ _id: id, imageUrl: 'https://example.com/image.png' }],
    }), /either text or an image/);
  });
}

test('reading import rejects invalid passages before writing any groups', async () => {
  const service = new QuestionsService({}, {}, {});
  await assert.rejects(service.importQuestions(id, {
    part: 7, section: 'READING', questions: [{ content: 'Question' }],
    passageGroups: [{ passages: [{ content: 'text', imageUrl: 'https://example.com/image.png' }] }],
  }), (error) => error.getResponse().message.some((message) => message.includes('văn bản hoặc ảnh')));
});
