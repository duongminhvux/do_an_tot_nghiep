import { Types } from 'mongoose';
import { ArenaRoundService } from './arena-round.service.js';
import {
  arenaHintLetters,
  arenaHintOrder,
  maskArenaAnswer,
  normalizeArenaAnswer,
} from './arena-round.utils.js';

vi.mock('../schemas/arena-match.schema.js', () => ({
  ArenaMatch: class {},
  ArenaMatchStatus: { PLAYING: 'PLAYING', FINISHED: 'FINISHED' },
}));
vi.mock('../schemas/arena-match-question.schema.js', () => ({
  ArenaMatchQuestion: class {},
}));
vi.mock('../schemas/arena-match-player.schema.js', () => ({
  ArenaMatchPlayer: class {},
}));
vi.mock('../schemas/arena-player-answer.schema.js', () => ({
  ArenaPlayerAnswer: class {},
}));

function fixture() {
  const matchId = new Types.ObjectId();
  const users = [new Types.ObjectId(), new Types.ObjectId()];
  const match = {
    _id: matchId,
    status: 'PLAYING',
    questionCount: 10,
    currentQuestionIndex: 1,
    secondsPerQuestion: 30,
    winnerId: null as Types.ObjectId | null,
    isDraw: false,
  };
  const questions = Array.from({ length: 10 }, (_, index) => ({
    _id: new Types.ObjectId(),
    matchId,
    order: index + 1,
    correctAnswer: 'thumb',
    question: 'ngón tay cái',
    explanation: 'The thumb is a digit.',
    example: 'She hurt her THUMB.',
    translation: 'Cô ấy bị đau ngón tay cái.',
    wordType: 'noun',
    startedAt: index === 0 ? new Date() : (null as Date | null),
    resolvedAt: null as Date | null,
    winnerId: null as Types.ObjectId | null,
  }));
  const players = users.map((userId) => ({
    _id: new Types.ObjectId(),
    matchId,
    userId,
    status: 'PLAYING',
    score: 0,
    currentStreak: 0,
    scoredQuestionIds: [] as string[],
    ratingBefore: 1000,
    ratingAfter: 1000,
    ratingChange: 0,
  }));
  const same = (a: unknown, b: unknown) => String(a) === String(b);
  const matches = {
    findById: vi.fn(async () => ({ ...match })),
    find: vi.fn(async () => (match.status === 'PLAYING' ? [{ ...match }] : [])),
    updateOne: vi.fn(async (filter, update) => {
      if (
        (filter.status && match.status !== filter.status) ||
        (filter.currentQuestionIndex &&
          match.currentQuestionIndex !== filter.currentQuestionIndex)
      )
        return { modifiedCount: 0 };
      Object.assign(match, update.$set);
      if (update.$inc)
        match.currentQuestionIndex += update.$inc.currentQuestionIndex;
      return { modifiedCount: 1 };
    }),
  };
  const questionModel = {
    findOne: vi.fn(async (filter) => {
      const q = questions.find(
        (q) => q.order === filter.order || same(q._id, filter._id),
      );
      return q ? { ...q } : null;
    }),
    findById: vi.fn(async (id) => {
      const q = questions.find((q) => same(q._id, id));
      return q ? { ...q } : null;
    }),
    findOneAndUpdate: vi.fn(async (filter, update) => {
      const q = questions.find((q) => same(q._id, filter._id));
      if (
        !q ||
        ('resolvedAt' in filter && q.resolvedAt) ||
        ('startedAt' in filter && q.startedAt)
      )
        return null;
      Object.assign(q, update.$set);
      return { ...q };
    }),
  };
  const playerModel = {
    exists: vi.fn(async (filter) =>
      players.some((p) => same(p.userId, filter.userId)),
    ),
    findOne: vi.fn(async (filter) => {
      const p = players.find((p) => same(p.userId, filter.userId));
      return p ? { ...p } : null;
    }),
    find: vi.fn(() => {
      const values = players.map((p) => ({ ...p }));
      return Object.assign(Promise.resolve(values), {
        sort: () => Promise.resolve(values.sort((a, b) => b.score - a.score)),
      });
    }),
    updateOne: vi.fn(async (filter, pipeline) => {
      const p = players.find((p) => same(p._id, filter._id));
      const qid = String(filter.scoredQuestionIds.$ne);
      if (!p || p.scoredQuestionIds.includes(qid)) return { modifiedCount: 0 };
      const won = pipeline[0].$set.score.$add[1] === 100;
      p.score += won ? 100 : 0;
      p.currentStreak = won ? p.currentStreak + 1 : 0;
      p.scoredQuestionIds.push(qid);
      return { modifiedCount: 1 };
    }),
    updateMany: vi.fn(async (_filter, update) => {
      for (const p of players) Object.assign(p, update.$set);
    }),
  };
  const answers = {
    findOne: vi.fn(async () => null),
    findOneAndUpdate: vi.fn(async () => ({})),
    updateOne: vi.fn(async () => ({})),
  };
  const scoring = {
    calculateQuestionScore: vi.fn(() => 100),
  };
  const matchService = {
    finishRankedMatch: vi.fn(async () => {
      const isDraw = players[0].score === players[1].score;
      match.status = 'FINISHED';
      match.isDraw = isDraw;
      match.winnerId = isDraw ? null : players[0].userId;
      return { status: 'FINISHED' };
    }),
  };
  const service = new ArenaRoundService(
    matches as never,
    questionModel as never,
    playerModel as never,
    answers as never,
    scoring as never,
    matchService as never,
  );
  const guess = (user = 0, answer = 'thumb') =>
    service.submitAnswer({
      matchId: String(matchId),
      questionId: String(questions[match.currentQuestionIndex - 1]._id),
      userId: String(users[user]),
      answer,
    });
  return {
    service,
    match,
    questions,
    players,
    users,
    matchId,
    guess,
    questionModel,
    answers,
  };
}

describe('Arena ranked rounds', () => {
  it('sends all masked clues before an answer and full details after resolution', async () => {
    const f = fixture();
    const events = await f.service.snapshot(String(f.matchId));
    expect(events[0]).toMatchObject({
      event: 'match:question',
      data: {
        meaning: 'ngón tay cái',
        explanation: 'The _____ is a digit.',
        example: 'She hurt her _____.',
        translation: 'Cô ấy bị đau ngón tay cái.',
        type: 'noun',
      },
    });
    const response = await f.guess();
    expect(response.events[0]).toMatchObject({
      event: 'match:question-resolved',
      data: {
        correctAnswer: 'thumb',
        explanation: 'The thumb is a digit.',
        example: 'She hurt her THUMB.',
      },
    });
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('accepts multiple wrong guesses without closing the question or leaking the answer', async () => {
    const f = fixture();
    for (const word of ['wrong', 'another']) {
      const response = await f.guess(0, word);
      expect(response.answerResult).toMatchObject({
        correct: false,
        resolved: false,
        points: 0,
      });
      expect(response.answerResult).not.toHaveProperty('correctAnswer');
      expect(response.events).toEqual([]);
    }
    expect(f.questions[0].resolvedAt).toBeNull();
    expect(f.answers.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect((await f.guess()).answerResult).toMatchObject({
      correct: true,
      resolved: true,
      totalScore: 100,
    });
  });

  it('awards only the first correct contender, including concurrent answers and retries', async () => {
    const f = fixture();
    const results = await Promise.all([f.guess(0), f.guess(1)]);
    expect(
      results.filter((result) => result.answerResult.correct),
    ).toHaveLength(1);
    expect(f.players.map((player) => player.score)).toEqual([100, 0]);
    await f.guess(0);
    await f.service.tick();
    expect(f.players.map((player) => player.score)).toEqual([100, 0]);
    const resolutionEvent = results
      .flatMap((result) => result.events)
      .find((event) => event.event === 'match:question-resolved');
    expect(resolutionEvent).toMatchObject({
      event: 'match:question-resolved',
      data: {
        winnerId: String(f.users[0]),
        correctAnswer: 'thumb',
        timedOut: false,
      },
    });
  });

  it('server clock reveals the answer even with no client submitting at timeout', async () => {
    const f = fixture();
    vi.setSystemTime(Date.now() + 30000);
    const batches = await f.service.tick();
    expect(batches[0].events).toContainEqual(
      expect.objectContaining({
        event: 'match:question-resolved',
        data: expect.objectContaining({
          winnerId: null,
          timedOut: true,
          correctAnswer: 'thumb',
        }),
      }),
    );
    expect(f.players.map((player) => player.score)).toEqual([0, 0]);
  });

  it('rejects correct guesses after the deadline without awarding points', async () => {
    const f = fixture();
    vi.setSystemTime(Date.now() + 30001);
    expect((await f.guess()).answerResult).toMatchObject({
      correct: false,
      timedOut: true,
      points: 0,
    });
  });

  it('runs exactly ten rounds and finishes with the score winner', async () => {
    const f = fixture();
    for (let index = 0; index < 10; index++) {
      await f.guess(index < 6 ? 0 : 1);
      expect(f.match.currentQuestionIndex).toBe(index + 1);
      vi.setSystemTime(Date.now() + 3001);
      const batches = await f.service.tick();
      if (index === 9)
        expect(batches[0].events.at(-1)).toMatchObject({
          event: 'match:finished',
          data: {
            winnerId: String(f.users[0]),
            isDraw: false,
          },
        });
    }
    expect(f.match.status).toBe('FINISHED');
    expect(f.players.map((player) => player.score)).toEqual([600, 400]);
    expect(await f.service.tick()).toEqual([]);
  });

  it('restores the current question and hints on reconnect without resetting the clock', async () => {
    const f = fixture();
    const startedAt = f.questions[0].startedAt!.toISOString();
    vi.setSystemTime(Date.now() + 18000);
    const events = await f.service.snapshot(String(f.matchId));
    expect(events[0]).toMatchObject({
      event: 'match:question',
      data: { startedAt, totalQuestions: 10 },
    });
    expect(events[1]).toMatchObject({
      event: 'match:hint',
      data: { letters: ['t', null, null, null, null] },
    });
    expect(JSON.stringify(events)).not.toContain('thumb');
  });

  it('blocks spectators and answers for future questions', async () => {
    const f = fixture();
    await expect(
      f.service.assertMember(String(f.matchId), String(new Types.ObjectId())),
    ).rejects.toThrow();
    await expect(
      f.service.submitAnswer({
        matchId: String(f.matchId),
        questionId: String(f.questions[1]._id),
        userId: String(f.users[0]),
        answer: 'thumb',
      }),
    ).rejects.toThrow('Question is not active');
  });
});

describe('Arena progressive hints', () => {
  it('masks answers in clues, including case, Unicode, phrases and regex characters', () => {
    expect(maskArenaAnswer('Thumb and THUMB', 'thumb')).toBe('_____ and _____');
    expect(maskArenaAnswer('An ＩＣＥ   ＣＲＥＡＭ.', 'ice cream')).toBe(
      'An _____.',
    );
    expect(maskArenaAnswer('Use C++.', 'C++')).toBe('Use _____.');
    expect(maskArenaAnswer(undefined, 'thumb')).toBeUndefined();
  });
  it('reveals first, last, middle and remaining gaps without repeating indices', () => {
    expect(arenaHintOrder('thumb')).toEqual([0, 4, 2, 1, 3]);
    expect(arenaHintOrder('ab')).toEqual([0, 1]);
    expect(arenaHintOrder('a')).toEqual([0]);
    expect(arenaHintOrder('')).toEqual([]);
  });
  it('reveals letters progressively and keeps punctuation and spaces visible', () => {
    expect(arenaHintLetters('thumb', 0, 30000)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(arenaHintLetters('thumb', 6000, 30000)).toEqual([
      't',
      null,
      null,
      null,
      null,
    ]);
    expect(arenaHintLetters('thumb', 12000, 30000)).toEqual([
      't',
      null,
      null,
      null,
      null,
    ]);
    expect(arenaHintLetters('thumb', 28500, 30000)).toEqual([
      't',
      null,
      null,
      null,
      null,
    ]);
    expect(arenaHintLetters('ice-cream', 0, 30000)[3]).toBe('-');
  });
  it('opens the entire 30% hint allowance by five seconds regardless of question duration', () => {
    const word = 'abcdefghij';
    expect(
      arenaHintLetters(word, 999, 30000).filter((char) => char !== null),
    ).toEqual([]);
    expect(
      arenaHintLetters(word, 1000, 30000).filter((char) => char !== null),
    ).toEqual(['a']);
    expect(
      arenaHintLetters(word, 3000, 30000).filter((char) => char !== null),
    ).toEqual(['a', 'j']);
    for (const limit of [5000, 15000, 30000, 60000]) {
      const hints = arenaHintLetters(word, 5000, limit);
      expect(hints.filter((char) => char !== null)).toEqual(['a', 'e', 'j']);
      expect(arenaHintLetters(word, 20000, limit)).toEqual(hints);
    }
  });
  it('never reveals more than 30% of letters, including short words and expired clocks', () => {
    for (let length = 1; length <= 30; length++) {
      const word = 'a'.repeat(length);
      for (const elapsed of [0, 6000, 15000, 28500, 30000, 60000]) {
        const revealed = arenaHintLetters(word, elapsed, 30000).filter(
          (char) => char !== null,
        ).length;
        expect(revealed).toBeLessThanOrEqual(Math.floor(length * 0.3));
      }
    }
    expect(arenaHintLetters('abcdefghij', 28500, 30000)).toEqual([
      'a',
      null,
      null,
      null,
      'e',
      null,
      null,
      null,
      null,
      'j',
    ]);
    expect(arenaHintLetters('ice-cream', 28500, 30000)).toEqual([
      'i',
      null,
      null,
      '-',
      null,
      null,
      null,
      null,
      'm',
    ]);
  });
  it('normalizes case, Unicode and spaces', () => {
    expect(normalizeArenaAnswer('  Ｔｈｕｍｂ  ')).toBe('thumb');
    expect(normalizeArenaAnswer('Ice   Cream')).toBe('ice cream');
  });
});
