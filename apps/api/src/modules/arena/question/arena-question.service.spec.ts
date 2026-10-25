import { describe, expect, it, vi } from 'vitest';
import { PgId, runAggregation } from '../../../postgres/compat.js';
import { ArenaQuestionService } from './arena-question.service.js';

describe('Arena question generation through the PostgreSQL repository', () => {
  function fixture() {
    const matchId = new PgId();
    const words = [
      { _id: new PgId(), word: 'apple', isActive: true, parts: [
        { partOfSpeech: 'noun', meanings: [
          { translation: [' ', 'quả táo'], definition: 'A fruit', examples: [{ en: 'An apple', vi: 'Một quả táo' }] },
          { translation: ['cây táo'] },
        ] },
      ] },
      { _id: new PgId(), word: 'chair', isActive: true, parts: [{ partOfSpeech: 'noun', meanings: [{ translation: ['ghế'] }] }] },
      { _id: new PgId(), word: 'blank', isActive: true, parts: [{ meanings: [{ translation: ['  ', ''] }] }] },
      { _id: new PgId(), word: 'deleted', isActive: true, isDeleted: true, parts: [{ meanings: [{ translation: ['đã xóa'] }] }] },
      { _id: new PgId(), word: 'inactive', isActive: false, parts: [{ meanings: [{ translation: ['ẩn'] }] }] },
    ];
    const saved: any[] = [];
    const questions = {
      find: vi.fn(() => ({ sort: async () => [...saved].sort((a,b) => a.order-b.order) })),
      bulkWrite: vi.fn(async (ops: any[]) => { for (const op of ops) saved.push({ _id: new PgId(), ...op.updateOne.update.$setOnInsert }); }),
    };
    const service = new ArenaQuestionService(
      { findById: async () => ({ status: 'COUNTDOWN', questionMode: 'MEANING_TO_WORD' }) } as any,
      questions as any,
      { aggregate: (pipeline: any[]) => runAggregation(pipeline, words) } as any,
    );
    return { service, matchId: String(matchId), saved, questions };
  }
  it('samples distinct usable words, preserves nested meaning snapshots and reuses them on reload', async () => {
    const f = fixture();
    const first = await f.service.createRankedQuestions(f.matchId, 2);
    expect(new Set(f.saved.map(q => String(q.vocabularyId))).size).toBe(2);
    expect(f.saved.find(q => q.correctAnswer === 'apple')).toMatchObject({
      question: 'quả táo', explanation: 'A fruit', example: 'An apple', translation: 'Một quả táo', wordType: 'noun',
    });
    expect(f.saved.map(q => q.correctAnswer).sort()).toEqual(['apple', 'chair']);
    expect(await f.service.createRankedQuestions(f.matchId, 2)).toEqual(first);
    expect(f.questions.bulkWrite).toHaveBeenCalledTimes(1);
  });
  it('rejects insufficient vocabulary without persisting a partial question set', async () => {
    const f = fixture();
    await expect(f.service.createRankedQuestions(f.matchId, 3)).rejects.toThrow('need 3, found 2');
    expect(f.questions.bulkWrite).not.toHaveBeenCalled();
  });
  it('supports sampling a five-letter word for Word Guess', async () => {
    const words = [{ word: 'apple' }, { word: 'chair' }, { word: 'cat' }];
    const result = await runAggregation([{ $match: { word: { $regex: '^[a-zA-Z]{5}$' } } }, { $sample: { size: 1 } }], words);
    expect(result).toHaveLength(1);
    expect(['apple','chair']).toContain(result[0].word);
  });
});
