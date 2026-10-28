import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {arenaFixture} from '../../../../test/arena-fixture.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('arena');
afterEach(()=>vi.unstubAllGlobals());
import {arenaHintLetters,arenaHintOrder,maskArenaAnswer,normalizeArenaAnswer} from './arena-round.utils.js';
describe('Arena ranked rounds on PostgreSQL',()=>{
  it('keeps clues masked until resolution, accepts wrong guesses and scores the winner once',async()=>{
    const f=await arenaFixture(suite),m=await f.match(),q=await f.question(m._id);
    const snapshot=await f.rounds.snapshot(m._id);expect(JSON.stringify(snapshot)).not.toContain('The thumb');
    const wrong=await f.rounds.submitAnswer({matchId:m._id,questionId:q._id,userId:f.users[0],answer:'wrong'});expect(wrong.answerResult.resolved).toBe(false);
    const guess=(userId:string)=>f.rounds.submitAnswer({matchId:m._id,questionId:q._id,userId,answer:'thumb'});
    await Promise.all([guess(f.users[0]),guess(f.users[1])]);await guess(f.users[0]);
    const players=await suite.records('arenamatchplayers').select(sql`match_id=${m._id}::uuid`);
    expect(players.reduce((sum,p)=>sum+p.correctAnswers,0)).toBe(1);expect(players.filter(p=>p.score>0)).toHaveLength(1);
    expect(players.every(p=>p.scoredQuestionIds.length===1)).toBe(true);
  });
  it('resolves a timed-out question without awarding points',async()=>{
    const f=await arenaFixture(suite),m=await f.match(),q=await f.question(m._id,1,{startedAt:new Date(Date.now()-31000)});
    const result=await f.rounds.submitAnswer({matchId:m._id,questionId:q._id,userId:f.users[0],answer:'thumb'});
    expect(result.answerResult.timedOut).toBe(true);expect(result.answerResult.points).toBe(0);
  });
  it('rejects spectators and future questions',async()=>{
    const f=await arenaFixture(suite),m=await f.match(),q=await f.question(m._id,2);
    for(const userId of [randomUUID(),f.users[0]])await expect(f.rounds.submitAnswer({matchId:m._id,questionId:q._id,userId,answer:'thumb'})).rejects.toThrow();
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
      null,
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
  it('uses elapsed question time and configurable intervals regardless of the time limit', () => {
    const word = 'abcdefghij';
    expect(
      arenaHintLetters(word, 9999, 30000).filter((char) => char !== null),
    ).toEqual([]);
    expect(
      arenaHintLetters(word, 10000, 30000).filter((char) => char !== null),
    ).toEqual(['a']);
    expect(
      arenaHintLetters(word, 17500, 30000).filter((char) => char !== null),
    ).toEqual(['a', 'j']);
    for (const limit of [15000, 30000, 60000]) {
      expect(arenaHintLetters(word, 10000, limit).filter(char=>char!==null)).toEqual(['a']);
      expect(arenaHintLetters(word, 14999, limit).filter(char=>char!==null)).toEqual(['a']);
      expect(
        arenaHintLetters(word, 15000, limit).filter(
          (char) => char !== null,
        ),
      ).toEqual(['a', 'j']);
      expect(
        arenaHintLetters(word, 20000, Math.max(limit,20000)).filter((char) => char !== null),
      ).toEqual(['a', 'e', 'j']);
    }
    expect(
      arenaHintLetters(word, 0, 5000).filter((char) => char !== null),
    ).toEqual([]);
  });
  it('honors the configured percentage and can disable hints or reveal the full answer', () => {
    const settings={startAfterSeconds:2,intervalSeconds:1,maxPercent:60};
    const revealed=(ms:number)=>arenaHintLetters('abcdefghij',ms,30000,settings).filter(char=>char!==null);
    expect(revealed(1999)).toHaveLength(0);
    expect(revealed(2000)).toHaveLength(1);
    expect(revealed(3000)).toHaveLength(2);
    expect(revealed(15000)).toHaveLength(6);
    expect(arenaHintLetters('apple',29000,30000,{...settings,maxPercent:0})).toEqual([null,null,null,null,null]);
    expect(arenaHintLetters('apple',29000,30000,{...settings,maxPercent:100})).toEqual(Array.from('apple'));
  });
  it('reveals at most 30% for longer words and one character for short words', () => {
    for (let length = 1; length <= 30; length++) {
      const word = 'a'.repeat(length);
      for (const elapsed of [0, 6000, 15000, 28500, 30000, 60000]) {
        const revealed = arenaHintLetters(word, elapsed, 30000).filter(
          (char) => char !== null,
        ).length;
        expect(revealed).toBeLessThanOrEqual(length >= 2 ? Math.max(1, Math.floor(length * 0.3)) : 0);
      }
    }
    expect(arenaHintLetters('cat', 24000, 30000)).toEqual(['c', null, null]);
    expect(arenaHintLetters('at', 24000, 30000)).toEqual(['a', null]);
    expect(arenaHintLetters('abcdefghij', 24000, 30000)).toEqual([
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
    expect(arenaHintLetters('ice-cream', 24000, 30000)).toEqual([
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
