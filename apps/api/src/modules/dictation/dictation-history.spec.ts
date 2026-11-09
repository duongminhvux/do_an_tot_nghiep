import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { databaseSuite } from '../../../test/native-database.js';
import { DictationHistoryService } from './dictation-history.service.js';
import { DictationHistoryQueryDto } from './dto/dictation-history.dto.js';
vi.mock('../assessment/exams/community/exam-profile-names.js', () => ({
  resolveExamNames: async (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, 'Learner'])),
}));
describe('Content-owned Dictation session history', () => {
  const suite = databaseSuite('content');
  async function fixture() {
    const lesson = await suite
      .records('dictationlessons')
      .insert({
        title: 'Practice',
        slug: randomUUID(),
        sentenceCount: 2,
        publicationRevision: 1,
      });
    await suite
      .records('dictationsegments')
      .insert({ lessonId: lesson._id, order: 0, text: 'Hello world.',startMs:0,endMs:1000,source:'TTS',language:'en-US',durationMs:1000 });
    await suite
      .records('dictationsegments')
      .insert({ lessonId: lesson._id, order: 1, text: 'Keep learning.',startMs:1000,endMs:2000,source:'TTS',language:'en-US',durationMs:1000 });
    return {
      service: new DictationHistoryService(suite.db),
      lesson: lesson._id,
      user: randomUUID(),
    };
  }
  it('writes progress and an immutable answer snapshot atomically; duplicate event does not repeat the mutation', async () => {
    const { service, lesson, user } = await fixture(),
      eventId = randomUUID();
    const work = vi.fn(async () => {
      await suite.db.query(
        'INSERT INTO dictationprogresses(user_id,lesson_id,completed,attempts) VALUES($1,$2,false,1)',
        [user, lesson],
      );
      return { completed: false, attempts: 1 };
    });
    const action = {
      type: 'ATTEMPT' as const,
      segmentIndex: 0,
      isCorrect: false,
      submittedText: 'hello',
      eventId,
    };
    await service.track(user, lesson, action, work);
    await service.track(user, lesson, action, work);
    expect(work).toHaveBeenCalledTimes(1);
    const sessions = await service.sessions(
      lesson,
      new DictationHistoryQueryDto(),
    );
    expect(sessions.items).toHaveLength(1);
    expect(sessions.items[0]).toMatchObject({
      attempts: 1,
      correct: 0,
      username: 'Learner',
    });
    const events = await service.events(
      lesson,
      sessions.items[0].id,
      new DictationHistoryQueryDto(),
    );
    expect(events.items[0]).toMatchObject({
      submitted_text: 'hello',
      reference_text: 'Hello world.',
      is_correct: false,
    });
    await expect(
      service.track(
        user,
        lesson,
        { ...action, submittedText: 'changed' },
        work,
      ),
    ).rejects.toThrow('Event ID already used');
    const other = await suite
      .records('dictationlessons')
      .insert({ title: 'Other', slug: randomUUID() });
    await expect(
      service.events(
        other._id,
        sessions.items[0].id,
        new DictationHistoryQueryDto(),
      ),
    ).rejects.toThrow('Practice session not found');
  });
  it('rolls back progress when recording fails and rejects invalid segments before mutation', async () => {
    const { service, lesson, user } = await fixture();
    await expect(
      service.track(
        user,
        lesson,
        { type: 'ATTEMPT', segmentIndex: 0, isCorrect: true },
        async () => {
          await suite.db.query(
            'INSERT INTO dictationprogresses(user_id,lesson_id) VALUES($1,$2)',
            [user, lesson],
          );
          throw new Error('failure');
        },
      ),
    ).rejects.toThrow('failure');
    expect(
      (await suite.db.query('SELECT * FROM dictationprogresses')).rows,
    ).toHaveLength(0);
    const work = vi.fn(async () => ({ completed: false }));
    await expect(
      service.track(user, lesson, { type: 'REPLAY', segmentIndex: 99 }, work),
    ).rejects.toThrow('Invalid dictation sentence index');
    expect(work).not.toHaveBeenCalled();
  });
  it('retains earlier sessions on reset and starts another session after an inactivity gap', async () => {
    const { service, lesson, user } = await fixture();
    await service.track(
      user,
      lesson,
      { type: 'REPLAY', segmentIndex: 0 },
      async () => ({ completed: false }),
    );
    await suite.db.query(
      "UPDATE dictation_learning_sessions SET started_at=now()-interval '1 hour',last_activity_at=now()-interval '31 minutes'",
    );
    await service.track(
      user,
      lesson,
      { type: 'ATTEMPT', segmentIndex: 0, isCorrect: true },
      async () => ({ completed: false }),
    );
    await service.track(user, lesson, { type: 'RESET' }, async () => ({
      success: true,
    }));
    const sessions = await service.sessions(
      lesson,
      new DictationHistoryQueryDto(),
    );
    expect(sessions.total).toBe(2);
    expect(sessions.items.every((s) => s.ended_at)).toBe(true);
    await service.track(
      user,
      lesson,
      { type: 'REPLAY', segmentIndex: 1 },
      async () => ({ completed: false }),
    );
    expect(
      (await service.sessions(lesson, new DictationHistoryQueryDto())).total,
    ).toBe(3);
    expect(
      (await suite.db.query('SELECT * FROM dictation_learning_events')).rows,
    ).toHaveLength(4);
  });
  it('shows legacy cumulative progress without inventing sessions and filters/paginates by lesson/user', async () => {
    const { service, lesson, user } = await fixture();
    await suite
      .records('dictationprogresses')
      .insert({
        userId: user,
        lessonId: lesson,
        completed: true,
        correctCount: 2,
        attempts: 3,
        completedSegments: [0, 1],
      });
    await suite
      .records('dictationprogresses')
      .insert({
        userId: randomUUID(),
        lessonId: lesson,
        completed: false,
        correctCount: 0,
        attempts: 1,
      });
    const page = await service.learners(lesson, {
      ...new DictationHistoryQueryDto(),
      status: 'completed',
      limit: 1,
    });
    expect(page.total).toBe(1);
    expect(page.items[0].user_id).toBe(user);
    expect(page.summary).toMatchObject({
      learners: 2,
      completed: 1,
      sessions: 0,
    });
    expect(
      (await service.sessions(lesson, new DictationHistoryQueryDto())).total,
    ).toBe(0);
    expect(
      (
        await service.learners(lesson, {
          ...new DictationHistoryQueryDto(),
          userId: randomUUID(),
        })
      ).total,
    ).toBe(0);
  });
  it('does not call a completed legacy lesson a completed new session after just one answer', async () => {
    const { service, lesson, user } = await fixture();
    await suite
      .records('dictationprogresses')
      .insert({ userId: user, lessonId: lesson, completed: true });
    await service.track(
      user,
      lesson,
      { type: 'ATTEMPT', segmentIndex: 0, isCorrect: true },
      async () => ({ completed: true }),
    );
    expect(
      (await service.sessions(lesson, new DictationHistoryQueryDto())).items[0]
        .completed,
    ).toBe(false);
    await service.track(
      user,
      lesson,
      { type: 'ATTEMPT', segmentIndex: 1, isCorrect: true },
      async () => ({ completed: true }),
    );
    expect(
      (await service.sessions(lesson, new DictationHistoryQueryDto())).items[0]
        .completed,
    ).toBe(true);
  });
});
