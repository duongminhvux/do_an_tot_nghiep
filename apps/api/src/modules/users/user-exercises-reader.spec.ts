import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { databaseSuite } from '../../../test/native-database.js';
import {
  readUserExercises,
  readUserExerciseDetail,
} from './user-exercises-reader.js';
import {
  UserExercisesReadDto,
  type ExerciseModule,
} from './dto/user-exercises.dto.js';
vi.mock('../vocabulary/content-reader.js', () => ({
  contentRows: async (_db: unknown, kind: string, input: { ids: string[] }) =>
    input.ids.map((id) => ({
      _id: id,
      title: 'Vocabulary lesson',
      word: 'example',
    })),
}));
const query = (
  module: ExerciseModule,
  userId: string,
  patch: Partial<UserExercisesReadDto> = {},
): UserExercisesReadDto => ({
  ...new UserExercisesReadDto(),
  module,
  userId,
  ...patch,
});
describe('Assessment exercise history', () => {
  const suite = databaseSuite('assessment');
  it('returns each attempt with the real estimated score and paginated answer snapshot, scoped to learner', async () => {
    const user = randomUUID(),
      foreign = randomUUID();
    const exam = await suite
      .records('exams')
      .insert({ name: 'Practice exam', slug: randomUUID(), type: 'TOEIC' });
    const q1 = randomUUID(),
      q2 = randomUUID();
    const snapshot = [q1, q2].map((id) => ({
      _id: id,
      part: 5,
      content: 'Choose a word',
      correctAnswer: 'A',
      options: [
        { key: 'A', text: 'one' },
        { key: 'B', text: 'two' },
      ],
    }));
    const attempt = await suite
      .records('attempts')
      .insert({
        userId: user,
        examId: exam._id,
        mode: 'TEST',
        status: 'FINISHED',
        startedAt: new Date('2026-11-01T00:00:00Z'),
        completedAt: new Date('2026-11-01T00:01:00Z'),
        durationSpent: 60,
        totalQuestions: 2,
        correctAnswers: 1,
        readingResult: { total: 2, correct: 1 },
        questionSnapshot: snapshot,
        answers: { [q1]: 'A', [q2]: 'B' },
      });
    await suite
      .records('attempts')
      .insert({
        userId: foreign,
        examId: exam._id,
        status: 'FINISHED',
        startedAt: new Date(),
      });
    const page = await readUserExercises(
      suite.db,
      'assessment',
      query('toeic', user, { limit: 1 }),
    );
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: attempt._id,
      correct: 1,
      total: 2,
      score: 5,
      scoreMax: 495,
    });
    const detail = await readUserExerciseDetail(
      suite.db,
      'assessment',
      query('toeic', user, { recordId: attempt._id, page: 2, limit: 1 }),
    );
    expect(detail.total).toBe(2);
    expect(detail.items[0]).toMatchObject({
      index: 2,
      submitted: 'B. two',
      expected: 'A. one',
      correct: false,
    });
    await expect(
      readUserExerciseDetail(
        suite.db,
        'assessment',
        query('toeic', foreign, { recordId: attempt._id }),
      ),
    ).rejects.toThrow('Exercise not found');
    expect(
      (
        await readUserExercises(
          suite.db,
          'assessment',
          query('toeic', user, { from: '2026-11-02T00:00:00Z' }),
        )
      ).total,
    ).toBe(0);
  });
});
describe('Learning exercise history', () => {
  const suite = databaseSuite('learning');
  it('keeps vocabulary sessions distinct and counts answers rather than pretending all lesson words were answered', async () => {
    const user = randomUUID(),
      lesson = randomUUID();
    const session = await suite
      .records('learningsessions')
      .insert({
        userId: user,
        lessonId: lesson,
        type: 'LESSON',
        startedAt: new Date(),
        endedAt: new Date(),
        completedWords: 1,
        totalWords: 10,
      });
    await suite
      .records('learningsessionwords')
      .insert({
        sessionId: session._id,
        wordId: randomUUID(),
        mode: 'FLASHCARD',
        rating: 'GOOD',
        isCorrect: true,
        answeredAt: new Date(),
      });
    await suite
      .records('learningsessions')
      .insert({
        userId: user,
        lessonId: lesson,
        type: 'REVIEW',
        startedAt: new Date(),
      });
    const page = await readUserExercises(
      suite.db,
      'learning',
      query('vocabulary', user, { status: 'completed' }),
    );
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      title: 'Vocabulary lesson',
      correct: 1,
      total: 1,
      metadata: { totalWords: 10 },
    });
    const detail = await readUserExerciseDetail(
      suite.db,
      'learning',
      query('vocabulary', user, { recordId: session._id }),
    );
    expect(detail.items[0]).toMatchObject({
      prompt: 'example',
      submitted: 'GOOD',
      correct: true,
    });
    expect(
      (
        await readUserExercises(
          suite.db,
          'learning',
          query('vocabulary', user, { status: 'unfinished' }),
        )
      ).total,
    ).toBe(1);
  });
  it('returns game scores without inventing question-level data and validates query bounds/owner', async () => {
    const user = randomUUID(),
      game = await suite
        .records('minigameresults')
        .insert({ userId: user, gameType: 'WORD_SHOOTER', score: 250 });
    const detail = await readUserExerciseDetail(
      suite.db,
      'learning',
      query('minigame', user, { recordId: game._id }),
    );
    expect(detail.record.score).toBe(250);
    expect(detail.items).toEqual([]);
    expect(detail.record.metadata.summaryOnly).toBe(true);
    await expect(
      readUserExercises(
        suite.db,
        'learning',
        query('minigame', user, { limit: 500 }),
      ),
    ).rejects.toThrow('Invalid exercise page');
    await expect(
      readUserExercises(suite.db, 'identity', query('minigame', user)),
    ).rejects.toThrow('Invalid exercise owner');
    await expect(
      readUserExercises(
        suite.db,
        'learning',
        query('minigame', user, { from: '2026-11-02', to: '2026-11-01' }),
      ),
    ).rejects.toThrow('Invalid exercise date range');
  });
});
describe('Content exercise history', () => {
  const suite = databaseSuite('content');
  it('returns recorded Dictation sessions and submitted text, never legacy progress as fabricated sessions', async () => {
    const user = randomUUID(),
      lesson = await suite
        .records('dictationlessons')
        .insert({ title: 'Listening', slug: randomUUID() });
    await suite
      .records('dictationprogresses')
      .insert({ userId: user, lessonId: lesson._id, completed: true });
    expect(
      (await readUserExercises(suite.db, 'content', query('dictation', user)))
        .total,
    ).toBe(0);
    const session = (
      await suite.db.query(
        'INSERT INTO dictation_learning_sessions(user_id,lesson_id,lesson_revision,sentence_count,completed) VALUES($1,$2,1,1,true) RETURNING id',
        [user, lesson._id],
      )
    ).rows[0];
    await suite.db.query(
      "INSERT INTO dictation_learning_events(id,session_id,action,segment_index,submitted_text,reference_text,is_correct,request_hash,result) VALUES($1,$2,'ATTEMPT',0,'Hello','Hello.',true,'hash','{}')",
      [randomUUID(), session.id],
    );
    const detail = await readUserExerciseDetail(
      suite.db,
      'content',
      query('dictation', user, { recordId: session.id }),
    );
    expect(detail.record).toMatchObject({
      title: 'Listening',
      correct: 1,
      total: 1,
    });
    expect(detail.items[0]).toMatchObject({
      submitted: 'Hello',
      expected: 'Hello.',
      correct: true,
    });
    await expect(
      readUserExerciseDetail(
        suite.db,
        'content',
        query('dictation', randomUUID(), { recordId: session.id }),
      ),
    ).rejects.toThrow('Exercise not found');
  });
});
describe('Arena exercise history', () => {
  const suite = databaseSuite('arena');
  it('uses the selected learner participant and returns only that participant answers', async () => {
    const user = randomUUID(),
      other = randomUUID();
    const match = await suite
      .records('arenamatches')
      .insert({
        type: 'RANK',
        status: 'FINISHED',
        winnerId: user,
        startedAt: new Date(),
        finishedAt: new Date(),
        questionCount: 1,
      });
    for (const id of [user, other])
      await suite
        .records('arenamatchplayers')
        .insert({
          matchId: match._id,
          userId: id,
          score: id === user ? 150 : 0,
          correctAnswers: id === user ? 1 : 0,
          ratingChange: id === user ? 16 : -16,
        });
    const question = await suite
      .records('arenamatchquestions')
      .insert({
        matchId: match._id,
        order: 1,
        type: 'MEANING_TO_WORD',
        question: 'A greeting',
        correctAnswer: 'hello',
      });
    for (const id of [user, other])
      await suite
        .records('arenaplayeranswers')
        .insert({
          matchId: match._id,
          matchQuestionId: question._id,
          userId: id,
          selectedAnswer: id === user ? 'hello' : 'bye',
          isCorrect: id === user,
          answeredAt: new Date(),
        });
    const detail = await readUserExerciseDetail(
      suite.db,
      'arena',
      query('arena', user, { recordId: match._id }),
    );
    expect(detail.record).toMatchObject({
      score: 150,
      metadata: { result: 'WIN', ratingChange: 16 },
    });
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0].submitted).toBe('hello');
    await expect(
      readUserExerciseDetail(
        suite.db,
        'arena',
        query('arena', randomUUID(), { recordId: match._id }),
      ),
    ).rejects.toThrow('Exercise not found');
  });
});
