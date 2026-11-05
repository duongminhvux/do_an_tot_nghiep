import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { examTimeLimitSeconds } from '@repo/shared-types/exam-timing';
import { databaseSuite } from '../../../../test/native-database.js';
import { DomainOutboxService } from '../../../common/events/domain-outbox.service.js';
import { ExamsService } from './exams.service.js';
import { AttemptsService } from '../attempts/attempts.service.js';
import { ExamMode } from '../attempts/attempt.types.js';
import { UpdateExamDto } from './dto/update-exam.dto.js';

describe('Exam timing preview and validation', () => {
  it('keeps legacy partial pacing and unlimited practice until settings are saved', () => {
    const parts = [
      { part: 1, totalQuestions: 6 },
      { part: 5, totalQuestions: 30 },
    ];
    expect(
      examTimeLimitSeconds('TEST', parts, [1], { durationMinutes: 120 }),
    ).toBe(180);
    expect(
      examTimeLimitSeconds('TEST', parts, [1, 5], { durationMinutes: 120 }),
    ).toBe(1560);
    expect(examTimeLimitSeconds('PRACTICE', parts, [1, 5])).toBeUndefined();
    expect(
      examTimeLimitSeconds('TEST', [], [1, 2, 3, 4, 5, 6, 7], {
        durationMinutes: 95,
      }),
    ).toBe(5700);
  });
  it('uses the exact configured duration for either full or partial attempts', () => {
    const exam = {
      timingSettings: { testDurationMinutes: 90, practiceDurationMinutes: 35 },
    };
    for (const selected of [[5], [1, 2, 3, 4, 5, 6, 7]]) {
      expect(examTimeLimitSeconds('TEST', [], selected, exam)).toBe(5400);
      expect(examTimeLimitSeconds('PRACTICE', [], selected, exam)).toBe(2100);
    }
    exam.timingSettings.practiceDurationMinutes = 0;
    expect(examTimeLimitSeconds('PRACTICE', [], [5], exam)).toBeUndefined();
  });
  it('rejects missing, fractional, negative and oversized settings at the API boundary', async () => {
    for (const timingSettings of [
      {},
      { testDurationMinutes: 0, practiceDurationMinutes: 0 },
      { testDurationMinutes: 12.5, practiceDurationMinutes: 30 },
      { testDurationMinutes: 60, practiceDurationMinutes: -1 },
      { testDurationMinutes: 1441, practiceDurationMinutes: 0 },
      { testDurationMinutes: 60, practiceDurationMinutes: 1441 },
      { testDurationMinutes: '60', practiceDurationMinutes: 0 },
    ])
      expect(
        (await validate(plainToInstance(UpdateExamDto, { timingSettings })))
          .length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(UpdateExamDto, {
          timingSettings: {
            testDurationMinutes: 60,
            practiceDurationMinutes: 0,
          },
        }),
      ),
    ).toHaveLength(0);
  });
});

const suite = databaseSuite('assessment');
describe('Saved per-exam timing in PostgreSQL', () => {
  let examId: string,
    userId: string,
    exams: ExamsService,
    attempts: AttemptsService;
  async function publish() {
    await suite.db.query(
      "SELECT set_config('vocalearn.publication_transition','1',false)",
    );
    try {
      await suite.db.query(
        "UPDATE exams SET publication_status='PUBLISHED' WHERE id=$1",
        [examId],
      );
    } finally {
      await suite.db.query(
        "SELECT set_config('vocalearn.publication_transition','',false)",
      );
    }
  }
  beforeEach(async () => {
    const outbox = new DomainOutboxService(suite.db);
    exams = new ExamsService(
      suite.db,
      { t: async (key: string) => key } as never,
      outbox,
    );
    attempts = new AttemptsService(suite.db, undefined, outbox);
    userId = randomUUID();
    const exam = await exams.create({
      name: 'Timing test',
      type: 'TOEIC',
    } as never);
    examId = (exam as any)._id;
    await suite.records('questions').insert({
      examId,
      section: 'READING',
      part: 5,
      content: 'Choose a word',
      options: [
        { key: 'A', text: 'One' },
        { key: 'B', text: 'Two' },
      ],
      correctAnswer: 'A',
      order: 1,
      isActive: true,
    });
    await publish();
  });
  it('persists independent limits, freezes existing deadlines and grades expired practice', async () => {
    const old = await attempts.create(userId, {
      examId,
      mode: ExamMode.TEST,
      selectedParts: [5],
    });
    const oldRow = (await suite.records('attempts').select())[0];
    await exams.update(examId, {
      timingSettings: { testDurationMinutes: 75, practiceDurationMinutes: 20 },
    });
    expect(await exams.findOne(examId)).toMatchObject({
      durationMinutes: 75,
      timingSettings: { testDurationMinutes: 75, practiceDurationMinutes: 20 },
    });
    await publish();
    await expect(attempts.create(userId,{examId,mode:ExamMode.TEST,selectedParts:[5]})).rejects.toMatchObject({status:409});
    const test = await attempts.create(randomUUID(), {
      examId,
      mode: ExamMode.TEST,
      selectedParts: [5],
    });
    const practiceUser=randomUUID();
    const practice = await attempts.create(practiceUser, {
      examId,
      mode: ExamMode.PRACTICE,
      selectedParts: [5],
    });
    const all = await suite.records('attempts').select();
    expect(all.find((row) => row._id === test._id)?.timeLimitSeconds).toBe(
      4500,
    );
    const practiceRow = all.find((row) => row._id === practice._id)!;
    expect(practiceRow.timeLimitSeconds).toBe(1200);
    expect(
      new Date(practiceRow.expiresAt).getTime() -
        new Date(practiceRow.startedAt).getTime(),
    ).toBe(1200000);
    expect(all.find((row) => row._id === old._id)?.expiresAt).toEqual(
      oldRow?.expiresAt,
    );
    await suite.db.query(
      "UPDATE attempts SET expires_at=now()-interval '1 minute',payload=payload || jsonb_build_object('activeSeconds',time_limit_seconds+31,'activeSince',NULL,'lastSeenAt',now()) WHERE id=$1",
      [practice._id],
    );
    expect(await attempts.findOne(practiceUser, practice._id)).toMatchObject({
      status: 'FINISHED',
    });
  });
  it('allows unlimited practice and keeps the existing duration editor in sync', async () => {
    await exams.update(examId, {
      timingSettings: { testDurationMinutes: 75, practiceDurationMinutes: 0 },
    });
    await exams.update(examId, { durationMinutes: 80 });
    expect(await exams.findOne(examId)).toMatchObject({
      timingSettings: { testDurationMinutes: 80, practiceDurationMinutes: 0 },
    });
    await publish();
    const created = await attempts.create(userId, {
      examId,
      mode: ExamMode.PRACTICE,
      selectedParts: [5],
    });
    const row = (await suite.records('attempts').select()).find(
      (row) => row._id === created._id,
    )!;
    expect(row.expiresAt).toBeFalsy();
    expect(row.timeLimitSeconds).toBeFalsy();
  });
});
