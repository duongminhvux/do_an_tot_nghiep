import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AttemptsService } from '../dist/modules/assessment/attempts/attempts.service.js';
import { AttemptsController } from '../dist/modules/assessment/attempts/attempts.controller.js';
import {
  AdminAttemptsController,
  AdminExamAttemptsController,
} from '../dist/modules/assessment/attempts/admin-attempts.controller.js';
import { AttemptSchema } from '../dist/modules/assessment/attempts/schemas/attempt.schema.js';
import { ExamSchema } from '../dist/modules/assessment/exams/schemas/exam.schema.js';
import { QuestionSchema } from '../dist/modules/assessment/questions/schemas/question.schema.js';
import { PassageSchema } from '../dist/modules/assessment/questions/schemas/passage.schema.js';
import { TransformInterceptor } from '../dist/common/interceptors/transform.interceptor.js';

test(
  'TOEIC result HTTP lifecycle and administration',
  { skip: !process.env.TOEIC_TEST_MONGO_URI, timeout: 30000 },
  async (t) => {
    const db = await mongoose
      .createConnection(process.env.TOEIC_TEST_MONGO_URI, {
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 5000,
      })
      .asPromise();
    const prefix = `toeic_http_${new mongoose.Types.ObjectId()}_`;
    const attempts = db.model('Attempt', AttemptSchema, `${prefix}attempts`);
    const exams = db.model('Exam', ExamSchema, `${prefix}exams`);
    const questions = db.model(
      'Question',
      QuestionSchema,
      `${prefix}questions`,
    );
    const passages = db.model('Passage', PassageSchema, `${prefix}passages`);
    const users = db.model(
      'User',
      new mongoose.Schema({ username: String, email: String }),
      `${prefix}users`,
    );
    const userId = new mongoose.Types.ObjectId();
    const examId = new mongoose.Types.ObjectId();
    const listeningId = new mongoose.Types.ObjectId();
    const readingId = new mongoose.Types.ObjectId();
    const groupId = new mongoose.Types.ObjectId();
    let app;
    try {
      await users.collection.insertOne({
        _id: userId,
        username: 'Result preview',
        email: 'result-preview@example.test',
      });
      await exams.collection.insertOne({
        _id: examId,
        name: 'Result API preview',
        slug: prefix,
        type: 'TOEIC',
        isActive: true,
        totalQuestions: 2,
      });
      await questions.collection.insertMany([
        {
          _id: listeningId,
          examId,
          part: 3,
          passageGroupId: groupId,
          content: 'Who is speaking?',
          options: [
            { key: 'A', text: 'A clerk' },
            { key: 'B', text: 'A driver' },
          ],
          correctAnswer: 'A',
          order: 1,
        },
        {
          _id: readingId,
          examId,
          part: 5,
          content: 'The report is _____.',
          options: [
            { key: 'A', text: 'ready' },
            { key: 'B', text: 'readily' },
          ],
          correctAnswer: 'A',
          order: 2,
        },
      ]);
      await passages.collection.insertOne({
        passageGroupId: groupId,
        content: 'Hidden listening transcript',
        audioUrl: '/preview.wav',
        order: 1,
      });
      const service = new AttemptsService(attempts, exams, questions, passages);
      const module = await Test.createTestingModule({
        controllers: [
          AttemptsController,
          AdminAttemptsController,
          AdminExamAttemptsController,
        ],
        providers: [{ provide: AttemptsService, useValue: service }],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api');
      app.use((req, _res, next) => {
        req.user = {
          _id: req.headers['x-test-user'] || String(userId),
          role: req.headers['x-test-role'] || 'USER',
        };
        next();
      });
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      app.useGlobalInterceptors(new TransformInterceptor());
      await app.listen(0, '127.0.0.1');
      const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
      const request = async (path, method = 'GET', body, headers = {}) => {
        const response = await fetch(base + path, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: response.status, body: await response.json() };
      };
      const created = await request('/attempts', 'POST', {
        examId: String(examId),
        mode: 'TEST',
        selectedParts: [3, 5],
      });
      assert.equal(created.status, 201);
      const id = created.body.data._id;
      let submitted;
      await t.test(
        'active payload hides answers and listening transcript',
        async () => {
          const active = await request(`/attempts/${id}`);
          assert.equal(active.status, 200);
          assert.ok(!JSON.stringify(active.body).includes('correctAnswer'));
          assert.ok(
            !JSON.stringify(active.body).includes(
              'Hidden listening transcript',
            ),
          );
          assert.equal(active.body.data.partResults, undefined);
        },
      );
      await t.test(
        'save and submit persist section and part results',
        async () => {
          assert.equal(
            (
              await request(`/attempts/${id}/answers`, 'PATCH', {
                questionId: String(listeningId),
                answer: 'B',
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await request(`/attempts/${id}/answers`, 'PATCH', {
                questionId: String(readingId),
                answer: 'A',
              })
            ).status,
            200,
          );
          const response = await request(`/attempts/${id}/submit`, 'POST');
          assert.equal(response.status, 201);
          submitted = response.body.data;
          assert.equal(submitted.correctAnswers, 1);
          assert.equal(submitted.incorrectAnswers, 1);
          assert.equal(submitted.unansweredQuestions, 0);
          assert.equal(submitted.accuracy, 50);
          assert.equal(submitted.listeningResult.correct, 0);
          assert.equal(submitted.readingResult.correct, 1);
          assert.equal(submitted.partResults.length, 2);
          const repeated = await request(`/attempts/${id}/submit`, 'POST');
          assert.equal(repeated.body.data.submittedAt, submitted.submittedAt);
          assert.equal(
            repeated.body.data.durationSpent,
            submitted.durationSpent,
          );
        },
      );
      const adminHeader = { 'x-test-role': 'ADMIN' };
      await t.test(
        'personal history and aggregate stats expose saved results',
        async () => {
          const history = await request(
            `/attempts?examId=${examId}&limit=10&status=FINISHED`,
          );
          assert.equal(history.status, 200);
          assert.equal(history.body.data.length, 1);
          assert.equal(history.body.data[0].correctAnswers, 1);
          const stats = await request('/attempts/stats');
          assert.equal(stats.status, 200);
          assert.equal(stats.body.data.totalCompleted, 1);
          assert.equal(stats.body.data.totalCorrect, 1);
          assert.equal(stats.body.data.avgAccuracy, 50);
        },
      );
      let adminList;
      await t.test(
        'admin exam history, details and stats use the expected response envelope',
        async () => {
          const listing = await request(
            `/admin/exams/${examId}/attempts`,
            'GET',
            undefined,
            adminHeader,
          );
          assert.equal(listing.status, 200);
          adminList = listing.body;
          assert.equal(adminList.data.total, 1);
          assert.equal(
            adminList.data.data[0].userId.username,
            'Result preview',
          );
          assert.equal(adminList.data.data[0].accuracy, 50);
          const detail = await request(
            `/admin/attempts/${id}`,
            'GET',
            undefined,
            adminHeader,
          );
          assert.equal(detail.status, 200);
          assert.equal(detail.body.data.questions.length, 2);
          const stats = await request(
            `/admin/exams/${examId}/attempts/stats`,
            'GET',
            undefined,
            adminHeader,
          );
          assert.equal(stats.status, 200);
          assert.equal(stats.body.data.totalCorrect, 1);
        },
      );
      await t.test(
        'admin access and result ownership are enforced',
        async () => {
          assert.equal(
            (await request(`/admin/exams/${examId}/attempts`)).status,
            403,
          );
          assert.equal((await request(`/admin/attempts/${id}`)).status, 403);
          assert.equal(
            (
              await request(`/attempts/${id}`, 'GET', undefined, {
                'x-test-user': String(new mongoose.Types.ObjectId()),
              })
            ).status,
            404,
          );
        },
      );
      await t.test(
        'history query validation rejects invalid limits, modes and personal user overrides',
        async () => {
          for (const query of [
            'limit=0',
            'limit=101',
            'page=0',
            'mode=INVALID',
            `userId=${userId}`,
          ])
            assert.equal(
              (await request(`/attempts?${query}`)).status,
              400,
              query,
            );
        },
      );
      if (process.env.TOEIC_RESULTS_FIXTURE_PATH) {
        await writeFile(
          process.env.TOEIC_RESULTS_FIXTURE_PATH,
          JSON.stringify({
            examId: String(examId),
            exam: {
              _id: String(examId),
              name: 'Result API preview',
              slug: prefix,
              type: 'TOEIC',
              isActive: true,
              totalQuestions: 2,
              durationMinutes: 120,
              order: 1,
              totalAttempts: 1,
            },
            user: {
              _id: String(userId),
              username: 'Result preview',
              email: 'result-preview@example.test',
              role: 'ADMIN',
            },
            adminList,
            history: (await request('/attempts')).body,
            stats: (await request('/attempts/stats')).body,
            submitted,
          }),
        );
      }
    } finally {
      await app?.close();
      for (const model of [attempts, exams, questions, passages, users])
        if (model.collection.name.startsWith(prefix))
          await model.collection.drop().catch((error) => {
            if (error.code !== 26) throw error;
          });
      await db.close();
    }
  },
);
