import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { databaseSuite } from '../../../test/native-database.js';
import { readUserLearning, userLearningProgress } from './user-learning-reader.js';
const owner = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../postgres/owner-client.js', () => ({ ownerRequest: owner.request }));
const metrics = (result: Awaited<ReturnType<typeof readUserLearning>>, key: string) => Object.fromEntries(result.modules.find(item => item.key === key)!.metrics.map(item => [item.key, item.value]));
describe('learning module summary', () => {
  const suite = databaseSuite('learning');
  it('uses owner-scoped SRS, games and active clock without counting individual word events as activities', async () => {
    const user = randomUUID(), foreign = randomUUID();
    for (const userId of [user, foreign]) {
      await suite.records('userwordreviews').insert({userId, wordId:randomUUID(), status:'MASTERED', correctCount:3, incorrectCount:1, nextReviewAt:new Date(Date.now()-1000)});
      await suite.records('minigameresults').insert({userId, gameType:'WORD_SHOOTER', score:10});
      await suite.records('userlessonprogresses').insert({userId, lessonId:randomUUID(),status:'COMPLETED'});
      for (const type of ['WORD_REVIEWED','GAME_COMPLETED']) await suite.records('learning_activities').insert({userId,module:'MINIGAME',type,sourceKey:randomUUID(),xp:10,occurredAt:new Date()});
      await suite.db.query('INSERT INTO user_active_time_slices(user_id,request_id,started_at,ended_at) VALUES($1,$2,$3,$4)',[userId,randomUUID(),new Date('2026-01-01T00:00:00Z'),new Date('2026-01-01T00:00:20Z')]);
    }
    const result=await readUserLearning(suite.db,'learning',user);
    expect(result.summary).toEqual({totalXp:20,activityCount:1,activeSeconds:20});
    expect(metrics(result,'VOCABULARY')).toEqual({wordsLearned:1,wordsMastered:1,wordsDue:1,lessonsCompleted:1,accuracy:75});
    expect(metrics(result,'MINIGAME')).toEqual({roundsPlayed:1,gameTypes:1});
    expect(metrics(await readUserLearning(suite.db,'learning',randomUUID()),'VOCABULARY').accuracy).toBeNull();
  });
  it('keeps unavailable modules distinct from real zero progress', async () => {
    vi.stubEnv('SERVICE_ROLE','identity');
    owner.request.mockImplementation(async (service:string) => { if(service==='content')throw new Error('offline');return {modules:[],...(service==='learning'?{summary:{totalXp:0,activityCount:0,activeSeconds:0}}:{})}; });
    const result=await userLearningProgress(suite.db,randomUUID());
    expect(result.modules).toEqual([{key:'DICTATION',state:'unavailable',metrics:[]}]);
    expect(result.summary?.totalXp).toBe(0);
  });
});
describe('assessment module summary',()=>{
  const suite=databaseSuite('assessment');
  it('counts all attempts but calculates weighted accuracy only for submitted attempts',async()=>{
    const user=randomUUID();
    for(const attempt of [{status:'FINISHED',totalQuestions:10,correctAnswers:8},{status:'COMPLETED',totalQuestions:30,correctAnswers:12},{status:'IN_PROGRESS',totalQuestions:10,correctAnswers:10}])await suite.records('attempts').insert({userId:user,examId:randomUUID(),startedAt:new Date(),...attempt});
    await suite.records('attempts').insert({userId:randomUUID(),examId:randomUUID(),startedAt:new Date(),status:'FINISHED',totalQuestions:100,correctAnswers:100});
    expect(metrics(await readUserLearning(suite.db,'assessment',user),'TOEIC')).toEqual({attempts:3,attemptsCompleted:2,attemptsInProgress:1,accuracy:50,bestAccuracy:80});
    expect(metrics(await readUserLearning(suite.db,'assessment',randomUUID()),'TOEIC').accuracy).toBeNull();
    await expect(readUserLearning(suite.db,'assessment','bad-id')).rejects.toThrow('Invalid user');
  });
});
describe('dictation module summary',()=>{
  const suite=databaseSuite('content');
  it('aggregates practiced lessons and completed segments for one user',async()=>{
    const user=randomUUID();
    const lesson = await suite.records('dictationlessons').insert({title:'Lesson',slug:'lesson'});
    const lesson2 = await suite.records('dictationlessons').insert({title:'Lesson 2',slug:'lesson-2'});
    await suite.records('dictationprogresses').insert({userId:user,lessonId:lesson._id,completed:true,completedSegments:[0,1,2],correctCount:3,wrongCount:1});
    await suite.records('dictationprogresses').insert({userId:user,lessonId:lesson2._id,completed:false,completedSegments:[0],correctCount:1,wrongCount:3});
    await suite.records('dictationprogresses').insert({userId:randomUUID(),lessonId:lesson._id,completed:true,completedSegments:[0],correctCount:20,wrongCount:0});
    expect(metrics(await readUserLearning(suite.db,'content',user),'DICTATION')).toEqual({lessonsStarted:2,lessonsCompleted:1,segmentsCompleted:4,accuracy:50});
  });
});
describe('arena module summary',()=>{
  const suite=databaseSuite('arena');
  it('uses ranked results and does not invent a rating for users with no profile',async()=>{
    const user=randomUUID();
    await suite.records('arenaprofiles').insert({userId:user,rating:1200,rankedMatches:10,rankedWins:6,rankedLosses:3,rankedDraws:1});
    expect(metrics(await readUserLearning(suite.db,'arena',user),'ARENA')).toEqual({rankedMatches:10,wins:6,losses:3,draws:1,rating:1200,winRate:60});
    const empty=metrics(await readUserLearning(suite.db,'arena',randomUUID()),'ARENA');expect(empty.rating).toBeNull();expect(empty.rankedMatches).toBe(0);expect(empty.winRate).toBeNull();
  });
});
