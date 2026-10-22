import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createConnection, Types, Schema as MongoSchema } from 'mongoose';
import { validate } from 'class-validator';
import { AttemptsService, publicQuestion } from './attempts.service.js';
import { ExamMode } from './attempt.types.js';
import { AttemptSchema } from './schemas/attempt.schema.js';
import { ExamSchema } from '../exams/schemas/exam.schema.js';
import { QuestionSchema } from '../questions/schemas/question.schema.js';
import { PassageSchema } from '../questions/schemas/passage.schema.js';
import { CreateAttemptDto } from './dto/create-attempt.dto.js';
import {
  AdminAttemptsController,
  AdminExamAttemptsController,
} from './admin-attempts.controller.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Reflector } from '@nestjs/core';
import { withAttemptCounts } from './exam-attempt-counts.js';
import { LearningActivityService } from '../../learning-activity/learning-activity.service.js';
import { LearningActivitySchema } from '../../learning-activity/schemas/learning-activity.schema.js';

describe('attempt administration permissions', () => {
  it.each([AdminAttemptsController, AdminExamAttemptsController])(
    'requires ADMIN for result endpoints',
    (controller) => {
      const guard = new RolesGuard(new Reflector());
      const context = (role?: string) =>
        ({
          getHandler: () => controller.prototype.list,
          getClass: () => controller,
          switchToHttp: () => ({
            getRequest: () => ({ user: role ? { role } : undefined }),
          }),
        }) as any;
      expect(guard.canActivate(context('ADMIN'))).toBe(true);
      expect(guard.canActivate(context('USER'))).toBe(false);
      expect(guard.canActivate(context())).toBe(false);
    },
  );
});

describe('TOEIC attempt contract', () => {
  it.each([1, 2])(
    'hides the spoken script and option text for Part %s until review',
    (part) => {
      const question = {
        _id: 'q',
        part,
        content: 'Hidden spoken prompt and choices',
        options: [
          { key: 'A', text: 'Hidden spoken choice' },
          { key: 'B', text: 'Another spoken choice' },
        ],
        imageUrl: '/photo.jpg',
        audioUrl: '/question.wav',
        passages: [
          { content: 'Hidden passage transcript', audioUrl: '/passage.wav' },
        ],
        correctAnswer: 'A',
      };
      const active = publicQuestion(question);
      expect(active.content).toBe('');
      expect(active.options).toEqual([
        { key: 'A', text: '' },
        { key: 'B', text: '' },
      ]);
      expect(active.audioUrl).toBe('/question.wav');
      expect(active.imageUrl).toBe('/photo.jpg');
      expect(active.passages[0].audioUrl).toBe('/passage.wav');
      expect(JSON.stringify(active)).not.toMatch(
        /Hidden|spoken choice|correctAnswer/,
      );
      const reviewed = publicQuestion(question, true);
      expect(reviewed.correctAnswer).toBe('A');
      expect(reviewed.transcript).toBe(question.content);
    },
  );

  it.each([3, 4])(
    'keeps printed questions and options but hides the dialogue for Part %s',
    (part) => {
      const question = {
        _id: 'q',
        part,
        content: 'Where are the speakers?',
        options: [{ key: 'A', text: 'At the office' }],
        passages: [{ content: 'Hidden dialogue', audioUrl: '/dialogue.wav' }],
        correctAnswer: 'A',
        transcript: 'Hidden dialogue',
      };
      const active = publicQuestion(question);
      expect(active.content).toBe(question.content);
      expect(active.options).toEqual(question.options);
      expect(active.passages[0].audioUrl).toBe('/dialogue.wav');
      expect(JSON.stringify(active)).not.toContain('Hidden dialogue');
    },
  );

  it.each([1, 2])(
    'returns the script only through authorized PRACTICE feedback for old Part %s snapshots',
    async (part) => {
      const userId = new Types.ObjectId().toString();
      const id = new Types.ObjectId().toString();
      const attempt = {
        status: 'IN_PROGRESS',
        mode: ExamMode.PRACTICE,
        answers: { q: 'A' },
        questionSnapshot: [
          {
            _id: 'q',
            part,
            content: 'Original spoken script',
            options: [],
            passages: [],
            correctAnswer: 'A',
          },
        ],
      };
      const attempts: any = {
        findOne: () => ({
          select: () => ({ lean: () => ({ exec: async () => attempt }) }),
        }),
      };
      const service = new AttemptsService(
        attempts,
        {} as any,
        {} as any,
        {} as any,
      );
      expect((await service.checkAnswer(userId, id, 'q')).transcript).toBe(
        'Original spoken script',
      );
      attempt.mode = ExamMode.TEST;
      await expect(service.checkAnswer(userId, id, 'q')).rejects.toThrow(
        'not available in TEST',
      );
    },
  );

  it.each([[], [5, 5], [0], [8], [5.5], ['5']].map((parts) => ({ parts })))(
    'rejects invalid selectedParts $parts',
    async ({ parts }) => {
      const dto = Object.assign(new CreateAttemptDto(), {
        examId: new Types.ObjectId().toString(),
        mode: ExamMode.TEST,
        selectedParts: parts,
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );

  it('does not leak solution fields, metadata, or hidden option properties', () => {
    const question: any = {
      _id: 'q',
      part: 5,
      content: 'Prompt',
      options: [{ key: 'A', text: 'One', isCorrect: true }],
      passages: [
        { content: 'Prompt', audioMeta: { segments: [{ text: 'secret' }] } },
      ],
      correctAnswer: 'A',
      explanation: 'secret',
      transcript: 'secret',
      answerKey: 'A',
      solution: 'secret',
      audioMeta: { segments: [{ text: 'secret' }] },
    };
    const payload = JSON.stringify(publicQuestion(question));
    for (const field of [
      'correctAnswer',
      'explanation',
      'transcript',
      'answerKey',
      'solution',
      'isCorrect',
      'audioMeta',
      'secret',
    ])
      expect(payload).not.toContain(field);
  });
});

describe('TOEIC attempt audio refresh', () => {
  const userId = new Types.ObjectId().toString();
  const id = new Types.ObjectId().toString();
  const examId = new Types.ObjectId();
  const questionId = new Types.ObjectId().toString();
  const groupId = new Types.ObjectId().toString();
  const passageId = new Types.ObjectId().toString();
  const query = (result: unknown) => {
    const chain: any = { exec: vi.fn().mockResolvedValue(result) };
    for (const method of ['select', 'sort', 'lean'])
      chain[method] = vi.fn(() => chain);
    return chain;
  };

  it.each([[], [{}]].map((snapshotPassages) => ({ snapshotPassages })))(
    'loads passage audio through the source question when snapshot passages are $snapshotPassages',
    async ({ snapshotPassages }) => {
      const snapshot = {
        _id: questionId,
        part: 3,
        content: 'Printed question',
        options: [],
        correctAnswer: 'A',
        passages: snapshotPassages,
      };
      const attempts: any = {
        findOne: () =>
          query({
            _id: id,
            userId,
            examId,
            status: 'IN_PROGRESS',
            questionSnapshot: [snapshot],
          }),
      };
      const questions: any = {
        find: vi.fn(() =>
          query([
            { _id: questionId, passageGroupId: new Types.ObjectId(groupId) },
          ]),
        ),
      };
      const passages: any = {
        find: vi.fn(() =>
          query([
            {
              _id: passageId,
              passageGroupId: new Types.ObjectId(groupId),
              audioUrl: '/original-passage.mp3',
              content: 'Hidden dialogue',
            },
            {
              _id: new Types.ObjectId(),
              passageGroupId: new Types.ObjectId(),
              audioUrl: '/different-group.mp3',
            },
          ]),
        ),
      };
      const loaded = await new AttemptsService(
        attempts,
        {} as any,
        questions,
        passages,
      ).findOne(userId, id);
      expect(passages.find).toHaveBeenCalledWith({
        passageGroupId: { $in: [new Types.ObjectId(groupId)] },
      });
      expect(loaded.questions[0].passageGroupId).toBe(groupId);
      expect(
        loaded.questions[0].passages.filter(
          (p: { audioUrl?: string }) => p.audioUrl,
        ),
      ).toEqual([
        expect.objectContaining({
          _id: passageId,
          audioUrl: '/original-passage.mp3',
        }),
      ]);
      expect(JSON.stringify(loaded.questions)).not.toMatch(
        /Hidden dialogue|different-group|correctAnswer/,
      );
      expect(snapshot.passages).toEqual(snapshotPassages);
    },
  );

  it.each([true, false])(
    'loads current question and passage audio with passage IDs: %s',
    async (withId) => {
      const snapshot = {
        _id: questionId,
        part: 3,
        passageGroupId: groupId,
        content: 'Frozen question',
        options: [{ key: 'A', text: 'Original option' }],
        correctAnswer: 'A',
        audioUrl: '/old-question.wav',
        transcript: 'Hidden transcript',
        passages: [
          {
            ...(withId ? { _id: passageId } : {}),
            audioUrl: '/old-passage.wav',
          },
        ],
      };
      const attempt = {
        _id: id,
        userId,
        examId,
        status: 'IN_PROGRESS',
        questionSnapshot: [snapshot],
      };
      const attempts: any = { findOne: vi.fn(() => query(attempt)) };
      const questions: any = {
        find: vi.fn(() =>
          query([
            {
              _id: questionId,
              audioUrl: '/uploaded-question.mp3',
              correctAnswer: 'B',
            },
          ]),
        ),
      };
      const passages: any = {
        find: vi.fn(() =>
          query([
            {
              _id: passageId,
              passageGroupId: groupId,
              audioUrl: '/uploaded-passage.mp3',
              content: 'Hidden live transcript',
            },
          ]),
        ),
      };
      const service = new AttemptsService(
        attempts,
        {} as any,
        questions,
        passages,
      );
      const loaded = await service.findOne(userId, id);
      expect(loaded.questions[0]).toMatchObject({
        content: 'Frozen question',
        audioUrl: '/uploaded-question.mp3',
        passages: [{ audioUrl: '/uploaded-passage.mp3' }],
      });
      expect(JSON.stringify(loaded.questions)).not.toMatch(
        /correctAnswer|transcript|Hidden|audioMeta/,
      );
      expect(snapshot.audioUrl).toBe('/old-question.wav');
      expect(snapshot.passages[0].audioUrl).toBe('/old-passage.wav');
      expect(questions.find).toHaveBeenCalledWith(
        expect.objectContaining({ examId }),
      );
    },
  );

  it('keeps snapshot audio when the source is missing and does not guess changed legacy passage order', async () => {
    const snapshot = {
      _id: questionId,
      part: 3,
      passageGroupId: groupId,
      content: 'Frozen question',
      options: [],
      correctAnswer: 'A',
      audioUrl: '/snapshot.wav',
      passages: [{ audioUrl: '/snapshot-passage.wav' }],
    };
    const attempts: any = {
      findOne: () =>
        query({
          _id: id,
          userId,
          examId,
          status: 'IN_PROGRESS',
          questionSnapshot: [snapshot],
        }),
    };
    const questions: any = { find: () => query([]) };
    const passages: any = {
      find: () =>
        query(
          [1, 2].map(() => ({
            _id: new Types.ObjectId(),
            passageGroupId: groupId,
            audioUrl: '/other.mp3',
          })),
        ),
    };
    const loaded = await new AttemptsService(
      attempts,
      {} as any,
      questions,
      passages,
    ).findOne(userId, id);
    expect(loaded.questions[0].audioUrl).toBe('/snapshot.wav');
    expect(loaded.questions[0].passages[0].audioUrl).toBe(
      '/snapshot-passage.wav',
    );
  });
});

// Opt-in real MongoDB tests. Each run owns uniquely named fixture collections.
describe.skipIf(!process.env.TOEIC_TEST_MONGO_URI)(
  'TOEIC attempts with MongoDB',
  () => {
    const connection = createConnection();
    const prefix = `toeic_test_${new Types.ObjectId()}_`;
    let service: AttemptsService;
    let attempts: any;
    let exams: any;
    let questions: any;
    let passages: any;
    let users: any;
    let activities: any;
    const userId = new Types.ObjectId().toString();
    const otherUserId = new Types.ObjectId().toString();
    const examId = new Types.ObjectId();
    const groupId = new Types.ObjectId();
    const q5 = new Types.ObjectId();
    const q6 = new Types.ObjectId();
    const q3 = new Types.ObjectId();

    beforeAll(async () => {
      await connection.openUri(process.env.TOEIC_TEST_MONGO_URI!, {
        autoIndex: false,
        serverSelectionTimeoutMS: 5000,
      });
      attempts = connection.model(
        'Attempt',
        AttemptSchema,
        `${prefix}attempts`,
      );
      exams = connection.model('Exam', ExamSchema, `${prefix}exams`);
      questions = connection.model(
        'Question',
        QuestionSchema,
        `${prefix}questions`,
      );
      passages = connection.model(
        'Passage',
        PassageSchema,
        `${prefix}passages`,
      );
      users = connection.model(
        'User',
        new MongoSchema({ username: String, email: String }),
        `${prefix}users`,
      );
      await users.collection.insertOne({
        _id: new Types.ObjectId(userId),
        username: 'Result learner',
        email: 'learner@example.test',
      });
      activities = connection.model(
        'LearningActivity',
        LearningActivitySchema,
        `${prefix}learning_activities`,
      );
      await activities.syncIndexes();
      service = new AttemptsService(
        attempts,
        exams,
        questions,
        passages,
        new LearningActivityService(activities),
      );
      await exams.collection.insertOne({
        _id: examId,
        name: 'Integration exam',
        slug: prefix,
        type: 'TOEIC',
        isActive: true,
      });
      await questions.collection.insertMany([
        {
          _id: q5,
          examId,
          part: 5,
          content: 'Sentence ____',
          options: [
            { key: 'A', text: 'Correct' },
            { key: 'B', text: 'Wrong' },
          ],
          correctAnswer: 'A',
          explanation: 'Explanation',
          order: 1,
        },
        {
          _id: q6,
          examId,
          part: 6,
          passageGroupId: groupId,
          content: 'Blank 1',
          options: [
            { key: 'A', text: 'Wrong' },
            { key: 'B', text: 'Correct' },
          ],
          correctAnswer: 'B',
          order: 2,
        },
        {
          _id: q3,
          examId,
          part: 3,
          passageGroupId: groupId,
          content: 'Who is speaking?',
          audioMeta: { segments: [{ text: 'Hidden transcript' }] },
          options: [
            { key: 'A', text: 'Clerk' },
            { key: 'B', text: 'Driver' },
          ],
          correctAnswer: 'A',
          order: 3,
        },
      ]);
      await passages.collection.insertOne({
        passageGroupId: groupId,
        content: 'Passage text',
        audioUrl: '/audio.mp3',
        order: 1,
      });
    });

    afterAll(async () => {
      for (const model of [attempts, exams, questions, passages, users]) {
        if (model?.collection.name.startsWith(prefix))
          await model.collection.drop().catch((error: any) => {
            if (error.code !== 26) throw error;
          });
      }
      await connection.close();
    });

    async function start(mode = ExamMode.TEST, selectedParts = [5]) {
      return (
        await service.create(userId, {
          examId: String(examId),
          mode,
          selectedParts,
        })
      )._id;
    }

    it('persists and returns empty answers before the first answer is saved', async () => {
      const id = await start();
      const stored = await attempts.collection.findOne({
        _id: new Types.ObjectId(id),
      });
      expect(stored.answers).toEqual({});
      const restored = await service.findOne(userId, id);
      expect(JSON.parse(JSON.stringify(restored)).answers).toEqual({});
      expect(Object.keys(restored.answers)).toHaveLength(0);
      expect(restored.answeredQuestions).toBe(0);
      const result = await service.submit(userId, id);
      expect(result.answers).toEqual({});
      expect(result.correctAnswers).toBe(0);
    });

    it.each(['missing', 'null'])(
      'returns empty answers for existing %s answers',
      async (state) => {
        const id = await start();
        await attempts.collection.updateOne(
          { _id: new Types.ObjectId(id) },
          state === 'missing'
            ? { $unset: { answers: '' } }
            : { $set: { answers: null } },
        );
        const restored = await service.findOne(userId, id);
        expect(restored.answers).toEqual({});
        expect(restored.answeredQuestions).toBe(0);
        const history = await service.findAll(userId);
        expect(history.find((row) => String(row._id) === id)?.answers).toEqual(
          {},
        );
        await service.saveAnswer(userId, id, {
          questionId: String(q5),
          answer: 'A',
        });
        expect((await service.findOne(userId, id)).answers[String(q5)]).toBe(
          'A',
        );
      },
    );

    it('lists only Parts containing active questions with actual counts', async () => {
      expect(
        (await service.availableParts(prefix)).map((p) => [
          p.part,
          p.totalQuestions,
        ]),
      ).toEqual([
        [3, 1],
        [5, 1],
        [6, 1],
      ]);
    });

    it.each([ExamMode.TEST, ExamMode.PRACTICE])(
      'creates, saves and resumes selected Parts in %s',
      async (mode) => {
        const id = await start(mode, [6, 5]);
        await service.saveAnswer(userId, id, {
          questionId: String(q5),
          answer: 'A',
        });
        await service.update(userId, id, {
          flaggedQuestions: [String(q6)],
          currentQuestionIndex: 1,
        });
        const restored = await service.findOne(userId, id);
        expect(restored.mode).toBe(mode);
        expect(restored.selectedParts).toEqual([5, 6]);
        expect(restored.questions.map((q: { part: number }) => q.part)).toEqual(
          [5, 6],
        );
        expect(restored.answers[String(q5)]).toBe('A');
        expect(restored.flaggedQuestions).toEqual([String(q6)]);
        expect(restored.currentQuestionIndex).toBe(1);
        const [answered, unanswered] = restored.questions as any[];
        // PRACTICE reveals the key of answered questions only; TEST never does.
        expect(answered.correctAnswer).toBe(
          mode === ExamMode.PRACTICE ? 'A' : undefined,
        );
        expect(JSON.stringify(unanswered)).not.toContain('correctAnswer"');
        expect(JSON.stringify(unanswered)).not.toContain('Explanation');
      },
    );

    it.each([ExamMode.TEST, ExamMode.PRACTICE])(
      'accepts only the first answer to a question in %s',
      async (mode) => {
        const id = await start(mode, [5]);
        const saved = await service.saveAnswer(userId, id, {
          questionId: String(q5),
          answer: 'B',
        });
        if (mode === ExamMode.PRACTICE)
          expect(saved).toMatchObject({
            saved: true,
            feedback: { correct: false, correctAnswer: 'A' },
          });
        else expect(saved).toEqual({ saved: true });
        await expect(
          service.saveAnswer(userId, id, {
            questionId: String(q5),
            answer: 'A',
          }),
        ).rejects.toThrow('already been answered');
        expect((await service.findOne(userId, id)).answers[String(q5)]).toBe(
          'B',
        );
      },
    );

    it.each([[4], [], [5, 5]].map((parts) => ({ parts })))(
      'rejects unavailable, empty or duplicate Parts: $parts',
      async ({ parts }) => {
        await expect(start(ExamMode.TEST, parts)).rejects.toThrow();
      },
    );

    it('creates all available Parts', async () => {
      expect(
        (await service.findOne(userId, await start(ExamMode.TEST, [3, 5, 6])))
          .totalQuestions,
      ).toBe(3);
    });

    it('enforces ownership across every attempt operation', async () => {
      const id = await start();
      for (const operation of [
        () => service.findOne(otherUserId, id),
        () =>
          service.saveAnswer(otherUserId, id, {
            questionId: String(q5),
            answer: 'A',
          }),
        () => service.update(otherUserId, id, { currentQuestionIndex: 0 }),
        () => service.checkAnswer(otherUserId, id, String(q5)),
        () => service.submit(otherUserId, id),
      ])
        await expect(operation()).rejects.toThrow('Attempt not found');
      expect(await service.findAll(otherUserId)).toEqual([]);
    });

    it('blocks TEST checks and gives no correctness in answer save responses', async () => {
      const id = await start();
      expect(
        await service.saveAnswer(userId, id, {
          questionId: String(q5),
          answer: 'A',
        }),
      ).toEqual({ saved: true });
      await expect(service.checkAnswer(userId, id, String(q5))).rejects.toThrow(
        'not available in TEST',
      );
    });

    it('rejects questions outside the selected Parts and invalid options', async () => {
      const id = await start();
      await expect(
        service.saveAnswer(userId, id, { questionId: String(q6), answer: 'A' }),
      ).rejects.toThrow();
      await expect(
        service.saveAnswer(userId, id, { questionId: String(q5), answer: 'D' }),
      ).rejects.toThrow();
      await expect(
        service.update(userId, id, { flaggedQuestions: [String(q6)] }),
      ).rejects.toThrow();
      await expect(
        service.update(userId, id, { currentQuestionIndex: 99 }),
      ).rejects.toThrow();
    });

    it('reveals PRACTICE feedback only after a saved answer; hides listening transcript before check', async () => {
      const id = await start(ExamMode.PRACTICE, [3]);
      const loaded = await service.findOne(userId, id);
      expect(JSON.stringify(loaded)).not.toContain('Hidden transcript');
      expect(JSON.stringify(loaded)).not.toContain('Passage text');
      await expect(service.checkAnswer(userId, id, String(q3))).rejects.toThrow(
        'Save an answer',
      );
      await service.saveAnswer(userId, id, {
        questionId: String(q3),
        answer: 'B',
      });
      expect(await service.checkAnswer(userId, id, String(q3))).toMatchObject({
        correct: false,
        correctAnswer: 'A',
        transcript: 'Hidden transcript\nPassage text',
      });
    });

    it('grades partial results, permits finished review, and rejects edits after submission', async () => {
      const id = await start(ExamMode.TEST, [5, 6]);
      await service.saveAnswer(userId, id, {
        questionId: String(q5),
        answer: 'A',
      });
      const result = await service.submit(userId, id);
      expect(result.status).toBe('FINISHED');
      expect(result.correctAnswers).toBe(1);
      expect(result.totalQuestions).toBe(2);
      // One correct Reading answer is worth table[1], never a scaled-up 50%.
      expect(result).toMatchObject({
        score: 5,
        scoreMax: 495,
        readingScore: 5,
        resultType: 'ESTIMATED',
      });
      expect(result.listeningScore).toBeUndefined();
      expect(result.partResults).toEqual([
        {
          part: 5,
          total: 1,
          correct: 1,
          answered: 1,
          incorrect: 0,
          unanswered: 0,
          accuracy: 100,
        },
        {
          part: 6,
          total: 1,
          correct: 0,
          answered: 0,
          incorrect: 0,
          unanswered: 1,
          accuracy: 0,
        },
      ]);
      expect(result.questions[0].correctAnswer).toBe('A');
      expect(result.questions[0].explanation).toBe('Explanation');
      expect((await service.submit(userId, id)).correctAnswers).toBe(1);
      await expect(
        service.saveAnswer(userId, id, { questionId: String(q5), answer: 'B' }),
      ).rejects.toThrow();
      await expect(
        service.update(userId, id, { currentQuestionIndex: 0 }),
      ).rejects.toThrow();
    });

    it('retains the original questions and answer keys if the source exam changes', async () => {
      const id = await start();
      await questions.collection.updateOne(
        { _id: q5 },
        { $set: { correctAnswer: 'B', explanation: 'Changed' } },
      );
      try {
        await service.saveAnswer(userId, id, {
          questionId: String(q5),
          answer: 'A',
        });
        const result = await service.submit(userId, id);
        expect(result.correctAnswers).toBe(1);
        expect(result.questions[0].explanation).toBe('Explanation');
      } finally {
        await questions.collection.updateOne(
          { _id: q5 },
          { $set: { correctAnswer: 'A', explanation: 'Explanation' } },
        );
      }
    });

    it('reserves exactly two TEST plays atomically, shared across passage questions and reloads', async () => {
      const sibling = new Types.ObjectId();
      await questions.collection.insertOne({
        _id: sibling,
        examId,
        part: 3,
        passageGroupId: groupId,
        content: 'A second question',
        options: [{ key: 'A', text: 'One' }],
        correctAnswer: 'A',
        order: 4,
      });
      try {
        const id = await start(ExamMode.TEST, [3]);
        const loaded = await service.findOne(userId, id);
        const passageId = loaded.questions[0].passages[0]._id!;
        // Four simultaneous starts/restarts, without waiting for playback to end.
        const results = await Promise.allSettled(
          [q3, sibling, q3, sibling].map((q) =>
            service.playAudio(userId, id, { questionId: String(q), passageId }),
          ),
        );
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
        expect(results.filter((r) => r.status === 'rejected')).toHaveLength(2);
        const restored = await service.findOne(userId, id);
        expect(restored.audioPlayCounts).toEqual({
          [`passage_${passageId}`]: 2,
        });
        await expect(
          service.playAudio(userId, id, {
            questionId: String(sibling),
            passageId,
          }),
        ).rejects.toThrow('Audio limit');
        await expect(
          service.playAudio(otherUserId, id, {
            questionId: String(q3),
            passageId,
          }),
        ).rejects.toThrow('Attempt not found');
      } finally {
        await questions.collection.deleteOne({ _id: sibling });
      }
    });

    it('counts question-level recordings separately and preserves both counts', async () => {
      const ids = [new Types.ObjectId(), new Types.ObjectId()];
      await questions.collection.insertMany(
        ids.map((_id, index) => ({
          _id,
          examId,
          part: 1,
          content: 'Spoken script',
          options: [{ key: 'A', text: '' }],
          correctAnswer: 'A',
          audioUrl: `/question-${index}.wav`,
          order: index + 1,
        })),
      );
      try {
        const id = await start(ExamMode.TEST, [1]);
        for (const questionId of ids) {
          expect(
            await service.playAudio(userId, id, {
              questionId: String(questionId),
            }),
          ).toMatchObject({ used: 1, limit: 2 });
          expect(
            await service.playAudio(userId, id, {
              questionId: String(questionId),
            }),
          ).toMatchObject({ used: 2, limit: 2 });
          await expect(
            service.playAudio(userId, id, { questionId: String(questionId) }),
          ).rejects.toThrow('Audio limit');
        }
        expect((await service.findOne(userId, id)).audioPlayCounts).toEqual(
          Object.fromEntries(ids.map((q) => [`question_${q}`, 2])),
        );
      } finally {
        await questions.collection.deleteMany({ _id: { $in: ids } });
      }
    });

    it.each(['missing', 'null'])(
      'initializes %s legacy play counts and uses the same counter for passage index and ID',
      async (initialState) => {
        const id = await start(ExamMode.TEST, [3]);
        await attempts.collection.updateOne(
          { _id: new Types.ObjectId(id) },
          initialState === 'null'
            ? { $set: { audioPlayCounts: null } }
            : { $unset: { audioPlayCounts: '' } },
        );
        const loaded = await service.findOne(userId, id);
        const passageId = loaded.questions[0].passages[0]._id!;
        expect(loaded.audioPlayCounts).toEqual({});
        expect(
          await service.playAudio(userId, id, {
            questionId: String(q3),
            passageIndex: 0,
          }),
        ).toMatchObject({ used: 1 });
        expect(
          await service.playAudio(userId, id, {
            questionId: String(q3),
            passageId,
          }),
        ).toMatchObject({ used: 2 });
        await expect(
          service.playAudio(userId, id, {
            questionId: String(q3),
            passageIndex: 0,
          }),
        ).rejects.toThrow('Audio limit');
      },
    );

    it('allows unlimited PRACTICE listening, rejects unrelated media, and locks submitted attempts', async () => {
      const id = await start(ExamMode.PRACTICE, [3]);
      const loaded = await service.findOne(userId, id);
      const passageId = loaded.questions[0].passages[0]._id!;
      for (let index = 0; index < 4; index++) {
        expect(
          await service.playAudio(userId, id, {
            questionId: String(q3),
            passageId,
          }),
        ).toMatchObject({ used: 0, limit: null });
      }
      expect((await service.findOne(userId, id)).audioPlayCounts).toEqual({});
      await expect(
        service.playAudio(userId, id, {
          questionId: String(q3),
          passageId: new Types.ObjectId().toString(),
        }),
      ).rejects.toThrow('Audio not available');
      await expect(
        service.playAudio(userId, id, { questionId: String(q5) }),
      ).rejects.toThrow('Invalid listening');
      await expect(
        service.playAudio(userId, id, { questionId: String(q3) }),
      ).rejects.toThrow('Audio not available');
      await expect(
        service.playAudio(userId, id, {
          questionId: String(q3),
          passageId,
          passageIndex: 0,
        }),
      ).rejects.toThrow('Invalid listening');
      await service.submit(userId, id);
      await expect(
        service.playAudio(userId, id, { questionId: String(q3), passageId }),
      ).rejects.toThrow('no longer in progress');
    });

    it('persists complete raw results and a stable duration across repeated submission and review', async () => {
      const id = await start(ExamMode.TEST, [3, 5, 6]);
      await attempts.collection.updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { startedAt: new Date(Date.now() - 65000) } },
      );
      await service.saveAnswer(userId, id, {
        questionId: String(q3),
        answer: 'B',
      });
      await service.saveAnswer(userId, id, {
        questionId: String(q5),
        answer: 'A',
      });
      const result = await service.submit(userId, id);
      expect(result).toMatchObject({
        resultVersion: 1,
        resultType: 'ESTIMATED',
        totalQuestions: 3,
        answeredQuestions: 2,
        correctAnswers: 1,
        totalCorrect: 1,
        incorrectAnswers: 1,
        unansweredQuestions: 1,
        accuracy: 33.33,
        listeningResult: {
          total: 1,
          answered: 1,
          correct: 0,
          incorrect: 1,
          unanswered: 0,
          accuracy: 0,
        },
        readingResult: {
          total: 2,
          answered: 1,
          correct: 1,
          incorrect: 0,
          unanswered: 1,
          accuracy: 50,
        },
      });
      expect(result.durationSpent).toBeGreaterThanOrEqual(65);
      const stored = await attempts.collection.findOne({
        _id: new Types.ObjectId(id),
      });
      expect(stored.accuracy).toBe(33.33);
      expect(stored.listeningResult).toEqual(result.listeningResult);
      expect(stored.partResults).toEqual(result.partResults);
      expect(stored.score).toBeUndefined();
      expect((await service.submit(userId, id)).durationSpent).toBe(
        result.durationSpent,
      );
      const restored = await service.findOne(userId, id);
      expect(restored.submittedAt).toEqual(result.submittedAt);
      expect(restored.readingResult).toEqual(result.readingResult);
      const listing = await service.adminList({
        examId: String(examId),
        userId,
      });
      const adminRow = listing.data.find((row) => String(row._id) === id)!;
      expect(adminRow.userId.username).toBe('Result learner');
      expect(adminRow).toMatchObject({
        correctAnswers: 1,
        incorrectAnswers: 1,
        unansweredQuestions: 1,
        accuracy: 33.33,
      });
      const detail = await service.adminFindOne(id);
      expect(detail.hasSnapshot).toBe(true);
      expect(detail.questions).toHaveLength(3);
      expect(detail.questions[0].correctAnswer).toBe('A');
    });

    it('returns filtered personal history and accurate raw stats without mixing other learners', async () => {
      const learner = new Types.ObjectId().toString();
      const first = (
        await service.create(learner, {
          examId: String(examId),
          mode: ExamMode.TEST,
          selectedParts: [3, 5, 6],
        })
      )._id;
      await service.saveAnswer(learner, first, {
        questionId: String(q3),
        answer: 'B',
      });
      await service.saveAnswer(learner, first, {
        questionId: String(q5),
        answer: 'A',
      });
      await service.submit(learner, first);
      const second = (
        await service.create(learner, {
          examId: String(examId),
          mode: ExamMode.PRACTICE,
          selectedParts: [5],
        })
      )._id;
      await service.saveAnswer(learner, second, {
        questionId: String(q5),
        answer: 'A',
      });
      await service.submit(learner, second);
      await service.create(learner, {
        examId: String(examId),
        mode: ExamMode.TEST,
        selectedParts: [6],
      });
      const stats = await service.stats(learner);
      expect(stats).toMatchObject({
        totalAttempts: 3,
        totalCompleted: 2,
        inProgress: 1,
        totalQuestions: 4,
        totalAnswered: 3,
        totalCorrect: 2,
        totalIncorrect: 1,
        totalUnanswered: 1,
        avgAccuracy: 66.67,
        // Parts 3, 5, 6 is not a full test, so no comparable total score.
        scoreAvailable: false,
      });
      expect(stats.readingResult).toMatchObject({
        total: 3,
        answered: 2,
        correct: 2,
        unanswered: 1,
      });
      expect((await service.findAll(learner, { limit: 1 })).length).toBe(1);
      const practice = await service.findAll(learner, {
        mode: 'PRACTICE',
        status: 'FINISHED',
        examId: prefix,
      });
      expect(practice).toHaveLength(1);
      expect(String(practice[0]._id)).toBe(second);
      expect(
        (await service.stats(learner, { mode: 'PRACTICE' })).totalCompleted,
      ).toBe(1);
      const active = await service.findAll(learner, { status: 'IN_PROGRESS' });
      expect(active).toHaveLength(1);
      expect(active[0].correctAnswers).toBeUndefined();
      expect(active[0].partResults).toBeUndefined();
      const admin = await service.adminList({ userId: learner, limit: 1 });
      expect(admin.total).toBe(3);
      expect(admin.data).toHaveLength(1);
    });

    it('aggregates more than one page of attempts instead of truncating statistics at 100', async () => {
      const learner = new Types.ObjectId();
      await attempts.collection.insertMany(
        Array.from({ length: 105 }, (_, index) => ({
          userId: learner,
          examId,
          mode: 'TEST',
          status: 'FINISHED',
          totalQuestions: 1,
          answeredQuestions: 1,
          correctAnswers: 1,
          accuracy: 100,
          durationSpent: 10,
          createdAt: new Date(Date.now() + index),
          partResults: [
            {
              part: 5,
              total: 1,
              answered: 1,
              correct: 1,
              incorrect: 0,
              unanswered: 0,
              accuracy: 100,
            },
          ],
        })),
      );
      const stats = await service.stats(String(learner));
      expect(stats).toMatchObject({
        totalAttempts: 105,
        totalCompleted: 105,
        totalCorrect: 105,
        totalDuration: 1050,
        avgDuration: 10,
      });
      expect(stats.partResults[0]).toMatchObject({
        part: 5,
        attempts: 105,
        total: 105,
        correct: 105,
      });
      expect(stats.recentAttempts).toHaveLength(5);
      const page = await service.adminList({
        userId: String(learner),
        page: 5,
        limit: 25,
      });
      expect(page.total).toBe(105);
      expect(page.data).toHaveLength(5);
    });

    it('records each graded attempt exactly once as a learning activity', async () => {
      const learner = new Types.ObjectId().toString();
      const owned = (id: string) =>
        activities.countDocuments({ sourceKey: `toeic:${id}` });
      const begin = async (mode: ExamMode) =>
        (
          await service.create(learner, {
            examId: String(examId),
            mode,
            selectedParts: [5],
          })
        )._id;

      const submitted = await begin(ExamMode.PRACTICE);
      await service.saveAnswer(learner, submitted, {
        questionId: String(q5),
        answer: 'A',
      });
      await service.submit(learner, submitted);
      await service.submit(learner, submitted);
      expect(await owned(submitted)).toBe(1);
      expect(
        await activities.findOne({ sourceKey: `toeic:${submitted}` }).lean(),
      ).toMatchObject({
        module: 'TOEIC',
        correct: 1,
        total: 1,
        xp: 11,
        title: 'Integration exam',
        link: `/toeic/attempts/${submitted}/result`,
      });

      const expired = await begin(ExamMode.TEST);
      await attempts.collection.updateOne(
        { _id: new Types.ObjectId(expired) },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } },
      );
      await service.findOne(learner, expired);
      expect(await owned(expired)).toBe(1);

      const stopped = await begin(ExamMode.PRACTICE);
      await service.abandon(learner, stopped);
      expect(await owned(stopped)).toBe(0);
    });

    it('times full-test attempts, refuses late answers and grades them when read', async () => {
      const id = await start(ExamMode.TEST, [5, 6]);
      const stored = await attempts.collection.findOne({
        _id: new Types.ObjectId(id),
      });
      // Two reading questions at 45 s each, rounded up to whole minutes.
      expect(stored.timeLimitSeconds).toBe(120);
      expect(stored.expiresAt.getTime() - stored.startedAt.getTime()).toBe(
        120_000,
      );
      await service.saveAnswer(userId, id, {
        questionId: String(q5),
        answer: 'A',
      });
      await attempts.collection.updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { expiresAt: new Date(Date.now() - 60_000) } },
      );
      await expect(
        service.saveAnswer(userId, id, {
          questionId: String(q6),
          answer: 'A',
        }),
      ).rejects.toThrow('Time is up');
      const graded = await service.findOne(userId, id);
      expect(graded.status).toBe('FINISHED');
      expect(graded.correctAnswers).toBe(1);
      const practice = await start(ExamMode.PRACTICE, [5]);
      const untimed = await attempts.collection.findOne({
        _id: new Types.ObjectId(practice),
      });
      expect(untimed.expiresAt).toBeUndefined();
    });

    it('lets a learner stop an unfinished attempt without grading it', async () => {
      const id = await start(ExamMode.PRACTICE, [5]);
      await expect(service.abandon(otherUserId, id)).rejects.toThrow();
      const stopped = await service.abandon(userId, id);
      expect(stopped.status).toBe('ABANDONED');
      expect(stopped.partResults).toBeUndefined();
      await expect(service.abandon(userId, id)).rejects.toThrow(
        'no longer in progress',
      );
      await expect(
        service.saveAnswer(userId, id, { questionId: String(q5), answer: 'A' }),
      ).rejects.toThrow();
    });

    it('averages estimated scores over full tests only', async () => {
      const learner = new Types.ObjectId();
      const full = (listening: number, reading: number, mode = 'TEST') => ({
        userId: learner,
        examId,
        mode,
        selectedParts: [1, 2, 3, 4, 5, 6, 7],
        status: 'FINISHED',
        totalQuestions: 200,
        answeredQuestions: 200,
        correctAnswers: listening + reading,
        createdAt: new Date(),
        listeningResult: { total: 100, correct: listening },
        readingResult: { total: 100, correct: reading },
      });
      await attempts.collection.insertMany([
        full(76, 75), // 410 + 365 = 775
        full(90, 90), // 495 + 450 = 945
        full(100, 100, 'PRACTICE'), // practice is never scored
        {
          ...full(50, 0),
          selectedParts: [1, 2, 3, 4],
          readingResult: { total: 0, correct: 0 },
        }, // listening only: no comparable total
      ]);
      const stats = await service.stats(String(learner), { days: 7 });
      expect(stats).toMatchObject({
        scoreAvailable: true,
        scoredAttempts: 2,
        avgScore: 860,
        highestScore: 945,
        avgListeningScore: Math.round((410 + 495 + 250) / 3),
        avgReadingScore: Math.round((365 + 450) / 2),
      });
      expect(stats.scoreDistribution).toEqual([
        { band: 'excellent', count: 1 },
        { band: 'good', count: 1 },
        { band: 'fair', count: 0 },
        { band: 'average', count: 0 },
        { band: 'low', count: 0 },
      ]);
      expect(stats.timeline.at(-1)).toMatchObject({ avgScore: 860 });
      expect(
        (await service.stats(String(learner), { mode: 'PRACTICE' }))
          .scoreAvailable,
      ).toBe(false);
    });

    it('limits stats to a period with a daily timeline, bands and the previous period', async () => {
      const learner = new Types.ObjectId();
      const daysAgo = (days: number) =>
        new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const finished = (createdAt: Date, correct: number, mode = 'TEST') => ({
        userId: learner,
        examId,
        mode,
        status: 'FINISHED',
        totalQuestions: 10,
        answeredQuestions: 10,
        correctAnswers: correct,
        durationSpent: 60,
        createdAt,
        listeningResult: { total: 4, accuracy: 50 },
        readingResult: { total: 6, accuracy: 100 },
      });
      await attempts.collection.insertMany([
        finished(daysAgo(1), 9),
        finished(daysAgo(1), 5, 'PRACTICE'),
        finished(daysAgo(10), 7),
        { ...finished(daysAgo(2), 0), status: 'IN_PROGRESS' },
      ]);
      const stats = await service.stats(String(learner), {
        days: 7,
        timezone: 'Asia/Ho_Chi_Minh',
      });
      expect(stats).toMatchObject({
        totalAttempts: 3,
        totalCompleted: 2,
        testAttempts: 2,
        practiceAttempts: 1,
        avgAccuracy: 70,
        previous: { totalAttempts: 1, totalCompleted: 1, avgAccuracy: 70 },
      });
      expect(stats.timeline).toHaveLength(2);
      expect(stats.timeline[1]).toMatchObject({
        attempts: 2,
        completed: 2,
        duration: 120,
        accuracy: 70,
        listeningAccuracy: 50,
        readingAccuracy: 100,
      });
      expect(stats.timeline[0]).toMatchObject({ completed: 0, accuracy: null });
      expect(stats.distribution).toEqual([
        { band: 'excellent', count: 1 },
        { band: 'good', count: 0 },
        { band: 'fair', count: 0 },
        { band: 'average', count: 1 },
        { band: 'low', count: 0 },
      ]);
      const oldest = await service.findAll(String(learner), { sort: 'oldest' });
      expect(new Date(oldest[0].createdAt).getTime()).toBeLessThan(
        new Date(oldest[1].createdAt).getTime(),
      );
    });

    it('reports actual exam attempt counts without counting repeated submit as another attempt', async () => {
      const before = await withAttemptCounts(attempts, [{ _id: examId }]);
      const id = await start();
      const started = await withAttemptCounts(attempts, [{ _id: examId }]);
      expect(started[0].totalAttempts).toBe(before[0].totalAttempts + 1);
      await service.submit(userId, id);
      await service.submit(userId, id);
      const after = await withAttemptCounts(attempts, [{ _id: examId }]);
      expect(after[0].totalAttempts).toBe(started[0].totalAttempts);
      expect(after[0].completedAttempts).toBe(before[0].completedAttempts + 1);
    });

    it('keeps grading consistent with answers when save races with submit', async () => {
      const id = await start();
      await Promise.allSettled([
        service.saveAnswer(userId, id, { questionId: String(q5), answer: 'A' }),
        service.submit(userId, id),
      ]);
      const result = await service.findOne(userId, id);
      expect(result.correctAnswers).toBe(
        result.answers[String(q5)] === 'A' ? 1 : 0,
      );
    });
  },
);
