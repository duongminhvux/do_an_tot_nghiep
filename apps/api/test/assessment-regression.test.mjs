// Run after `pnpm --filter api build` so Nest decorator metadata is available.
import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QuestionSchema } from '../dist/modules/assessment/questions/schemas/question.schema.js';
import { CreateQuestionDto } from '../dist/modules/assessment/questions/dto/create-question.dto.js';
import { UpdateQuestionDto } from '../dist/modules/assessment/questions/dto/update-question.dto.js';
import { QuestionsService } from '../dist/modules/assessment/questions/questions.service.js';
import { CreateExamDto } from '../dist/modules/assessment/exams/dto/create-exam.dto.js';
import { QueryExamDto } from '../dist/modules/assessment/exams/dto/query-exam.dto.js';
import { ManagedMediaService } from '../dist/modules/upload/managed-media.service.js';

const Question = mongoose.model('AssessmentRegressionQuestion', QuestionSchema);
const payload = {
  examId: new mongoose.Types.ObjectId().toString(),
  section: 'LISTENING', part: 1, content: 'What is shown?',
  options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Option ${key}` })),
  correctAnswer: 'B', order: 1, isActive: false,
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/questions/photo.jpg',
  audioUrl: 'https://res.cloudinary.com/demo/video/upload/v1/questions/audio.mp3',
};

test('question payload passes strict DTO validation and preserves draft state and media in Mongo document', async () => {
  const dto = plainToInstance(CreateQuestionDto, payload);
  assert.deepEqual(await validate(dto, { whitelist: true, forbidNonWhitelisted: true }), []);
  class CapturedQuestion extends Question {
    async save() { await this.validate(); return this; }
  }
  const service = new QuestionsService(CapturedQuestion, {}, {});
  const saved = (await service.create(dto)).toObject();
  assert.equal(saved.isActive, false);
  assert.equal(saved.imageUrl, payload.imageUrl);
  assert.equal(saved.audioUrl, payload.audioUrl);
  assert.equal(saved.status, undefined);
});

test('exam draft accepts boolean false; strings are rejected', async () => {
  const dto = plainToInstance(CreateExamDto, { name: 'Draft', type: 'TOEIC', mode: 'PRACTICE', isActive: false });
  assert.deepEqual(await validate(dto), []);
  dto.isActive = 'ACTIVE';
  assert.ok((await validate(dto)).some((error) => error.property === 'isActive'));
});

test('query false is parsed as false and malformed values are rejected', async () => {
  const dto = plainToInstance(QueryExamDto, { isActive: 'false' });
  assert.equal(dto.isActive, false);
  assert.deepEqual(await validate(dto), []);
  const invalid = plainToInstance(QueryExamDto, { isActive: 'invalid' });
  assert.ok((await validate(invalid)).some((error) => error.property === 'isActive'));
});

test('question list preserves legacy inactive records and new boolean state', async () => {
  const rows = [{ status: 'INACTIVE' }, { status: 'ACTIVE', isActive: false }, { isActive: true }];
  const query = { sort() { return this; }, populate() { return this; }, lean() { return this; }, async exec() { return rows; } };
  const service = new QuestionsService({ find: () => query }, {}, {});
  const result = await service.findByExam(payload.examId);
  assert.deepEqual(result.map((q) => q.isActive), [false, false, true]);
});

test('MinIO managed upload returns object URL and deletes only its own object', async () => {
  const deleted = [];
  const media = {
    async saveBuffer(key, buffer) {
      assert.ok(Buffer.isBuffer(buffer));
      assert.ok(key.startsWith('uploads/questions/'));
      return { url: `https://media.example.com/${key}`, storageKey: key };
    },
    storageKeyFromPublicUrl(url) {
      return url?.startsWith('https://media.example.com/uploads/')
        ? url.slice('https://media.example.com/'.length) : null;
    },
    async delete(key) { deleted.push(key); },
  };
  const service = new ManagedMediaService(media);
  const uploaded = await service.uploadFile({ buffer: Buffer.from('image'), originalname: 'cover.png' }, 'questions');
  assert.ok(uploaded.url.startsWith('https://media.example.com/uploads/questions/'));
  assert.ok(uploaded.public_id.startsWith('s3:uploads/questions/'));
  await service.deleteFile(uploaded.url);
  assert.deepEqual(deleted, [uploaded.public_id.slice(3)]);
  // Migrated documents might still refer to external assets; never delete those remotely.
  assert.deepEqual(await service.deleteFile(payload.imageUrl), { result: 'external-not-managed' });
  assert.equal(deleted.length, 1);
});

test('editing group questions accepts the group ID and explicitly clearing imageUrl', async () => {
  const dto = plainToInstance(UpdateQuestionDto, {
    content: 'Updated question', passageGroupId: new mongoose.Types.ObjectId().toString(), imageUrl: '',
  });
  assert.deepEqual(await validate(dto, { whitelist: true, forbidNonWhitelisted: true }), []);
});

test('replacing a passage image preserves shared assets; clearing the last reference deletes it', async () => {
  const oldUrl = 'https://media.example.com/uploads/questions/old-image.jpg';
  const id = new mongoose.Types.ObjectId().toString();
  const deleted = [];
  let questionReference = { _id: 'shared-question', imageUrl: oldUrl };
  const query = (value) => ({ lean() { return this; }, async exec() { return value; } });
  const passageModel = {
    findById: () => query({ imageUrl: oldUrl, passageGroupId: id, toObject() { return { imageUrl: oldUrl }; } }),
    findByIdAndUpdate: (_id, update) => query({ ...update.$set }),
    exists: async () => null,
  };
  const questionModel = {
    findById: () => query(questionReference),
    findByIdAndUpdate: (_id, update) => {
      const previous = questionReference;
      questionReference = null;
      return query({ ...previous, ...update.$set });
    },
    exists: async () => questionReference,
  };
  const managed = { isManagedUrl: (url) => url.startsWith('https://media.example.com/'), deleteFile: async (url) => deleted.push(url) };
  const service = new QuestionsService(questionModel, { findById: () => query({ part: 3 }) }, passageModel, managed);
  await service.updatePassage(id, { imageUrl: 'https://example.com/replacement.png' });
  assert.deepEqual(deleted, []);
  const updated = await service.update(id, { imageUrl: '' });
  assert.equal(updated.imageUrl, '');
  assert.deepEqual(deleted, [oldUrl]);
});
