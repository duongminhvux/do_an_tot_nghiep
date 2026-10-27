import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { makePgModel, PgId, createConnection } from '../../../postgres/compat.js';
import { DomainOutboxService } from '../../../common/events/domain-outbox.service.js';
import { ArenaMatch, ArenaMatchStatus as Status, ArenaMatchType, ArenaMatchFinishReason } from '../schemas/arena-match.schema.js';
import { ArenaMatchPlayer } from '../schemas/arena-match-player.schema.js';
import { ArenaMatchQuestion } from '../schemas/arena-match-question.schema.js';
import { ArenaPlayerAnswer } from '../schemas/arena-player-answer.schema.js';
import { ArenaProfile } from '../schemas/arena-profile.schema.js';
import { ArenaRatingHistory } from '../schemas/arena-rating-history.schema.js';
import { FriendRoom } from '../schemas/friend-room.schema.js';
import { ArenaRoundService } from '../question/arena-round.service.js';
import { ArenaScoringService } from '../scoring/arena-scoring.service.js';
import { ArenaRatingService } from '../rating/arena-rating.service.js';
import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { ArenaMatchTransactions } from './arena-match-transactions.js';
import { ArenaRankedConnectionService } from './arena-ranked-connection.service.js';
import { ArenaMatchService } from './arena-match.service.js';

describe.runIf(Boolean(process.env.ARENA_TEST_DATABASE_URL))('Ranked AFK/reconnect with real PostgreSQL transactions', () => {
  const pool = new Pool({ connectionString: process.env.ARENA_TEST_DATABASE_URL, max: 12 });
  const matchIds: string[] = [], userIds: string[] = [];
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
  afterAll(async () => {
    try {
      for (const table of ['arenaplayeranswers','arenamatchquestions','arenamatchplayers','arenaratinghistories'])
        await pool.query(`DELETE FROM public.${table} WHERE match_id=ANY($1::uuid[])`, [matchIds]);
      await pool.query('DELETE FROM public.arenamatches WHERE id=ANY($1::uuid[])', [matchIds]);
      await pool.query('DELETE FROM public.arenaprofiles WHERE user_id=ANY($1::uuid[])', [userIds]);
      await pool.query('DELETE FROM public.outbox_events WHERE aggregate_id=ANY($1::uuid[])', [userIds]);
    } finally { await pool.end(); }
  });
  async function fixture(overrides: Partial<typeof ARENA_DEFAULTS.rankedConnection> = {}) {
    vi.stubEnv('SERVICE_ROLE', 'arena');
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = Date.parse('2026-10-25T12:00:00Z'); vi.setSystemTime(now);
    const models = {
      matches: makePgModel<ArenaMatch>(ArenaMatch.name,pool), players: makePgModel<ArenaMatchPlayer>(ArenaMatchPlayer.name,pool),
      questions: makePgModel<ArenaMatchQuestion>(ArenaMatchQuestion.name,pool), answers: makePgModel<ArenaPlayerAnswer>(ArenaPlayerAnswer.name,pool),
      profiles: makePgModel<ArenaProfile>(ArenaProfile.name,pool), history: makePgModel<ArenaRatingHistory>(ArenaRatingHistory.name,pool),
      rooms: makePgModel<FriendRoom>(FriendRoom.name,pool),
    };
    const ids = [String(new PgId()),String(new PgId())]; userIds.push(...ids);
    const online = new Set(ids);
    const presence = { isOnline: vi.fn(async (id: string) => online.has(id)) };
    const transactions = new ArenaMatchTransactions(createConnection(pool));
    const matches = new ArenaMatchService({} as any,models.matches,models.players,models.profiles,models.history,{} as any,new ArenaRatingService(),models.rooms,undefined,undefined,new DomainOutboxService(createConnection(pool)),transactions);
    const rounds = new ArenaRoundService(models.matches,models.questions,models.players,models.answers,new ArenaScoringService(),matches,transactions);
    const service = new ArenaRankedConnectionService(models.matches,models.players,models.questions,models.answers,presence as any,rounds,matches,transactions);
    const match = await models.matches.create({ type: ArenaMatchType.RANK,status: Status.PLAYING,questionCount: 3,currentQuestionIndex: 1,secondsPerQuestion: 30,startedAt: new Date(now),runtimePolicy: { rankedConnection: {...ARENA_DEFAULTS.rankedConnection,...overrides} } });
    const matchId = String(match._id); matchIds.push(matchId);
    for (const id of ids) {
      await models.players.create({ matchId: match._id,userId: new PgId(id),ratingBefore: 1000,status: 'PLAYING' });
      await models.profiles.create({ userId: new PgId(id),rating: 1000 });
    }
    const questions = await models.questions.insertMany([1,2,3].map(order => ({ matchId: match._id,vocabularyId: new PgId(),order,type:'MEANING_TO_WORD',question:'quả táo',correctAnswer:'apple',...(order===1?{startedAt:new Date(now)}:{}) })));
    const tick = async (offset: number) => { vi.setSystemTime(now+offset); return service.tick(now+offset); };
    const disconnect = async (index=0) => { online.delete(ids[index]); await service.disconnected(matchId,ids[index]); };
    const reconnect = async (index=0) => { online.add(ids[index]); await service.restore(matchId,ids[index]); };
    const sync = async () => { const snap = await service.snapshot(matchId); for (const id of ids) if (online.has(id)) await service.acknowledge(matchId,id,snap.version); };
    const status = async () => (await models.matches.findById(matchId))!;
    const submit = () => rounds.submitAnswer({matchId,questionId:String(questions[0]._id),userId:ids[0],answer:'apple'});
    return { ...models,service,rounds,matchService:matches,transactions,ids,online,now,matchId,questionId:questions[0]._id,tick,disconnect,reconnect,sync,status,submit };
  }
  it('T01/T04/T17: F5 inside grace and closing one of several tabs neither pauses nor forfeits', async () => {
    const f = await fixture();
    await f.service.disconnected(f.matchId,f.ids[0]); // Another tab is online.
    expect((await f.status()).rankedState).toBeNull();
    await f.disconnect(); await f.tick(2000); await f.reconnect();
    await f.tick(4000);
    expect((await f.status()).status).toBe(Status.PLAYING);
    expect((await f.players.findOne({matchId:f.matchId,userId:f.ids[0]}))?.status).toBe('PLAYING');
    expect((await f.questions.findById(f.questionId))?.startedAt?.getTime()).toBe(f.now);
  });
  it('T02/T08/T09/T12: freezes timers and hints, rejects answers, requires both sync acknowledgements then resumes', async () => {
    const f = await fixture();
    vi.setSystemTime(f.now+15000); await f.disconnect(); await f.tick(19000);
    const before = await f.service.snapshot(f.matchId);
    expect(before.status).toBe(Status.PAUSED); expect(before.remainingMs).toBe(12000);
    expect(before.question.letters.some(Boolean)).toBe(true);
    await expect(f.submit()).rejects.toThrow();
    await f.tick(25000);
    const frozen = await f.service.snapshot(f.matchId);
    expect(frozen.remainingMs).toBe(before.remainingMs); expect(frozen.question.letters).toEqual(before.question.letters);
    await f.reconnect(); await f.tick(26000);
    expect((await f.status()).status).toBe(Status.PAUSED);
    await f.sync(); await f.tick(27000);
    expect((await f.status()).status).toBe(Status.RESUMING);
    await expect(f.submit()).rejects.toThrow();
    await f.tick(30000);
    expect((await f.status()).status).toBe(Status.PLAYING);
    expect((await f.service.snapshot(f.matchId)).remainingMs).toBe(12000);
    expect((await f.service.snapshot(f.matchId)).question.letters).toEqual(before.question.letters);
  });
  it('T03/T10/T15: two workers expire one player exactly once and only one rating/result event set is committed', async () => {
    const f = await fixture(); await f.disconnect(); await f.tick(4000);
    vi.setSystemTime(f.now+64000);
    await Promise.all([f.service.tick(f.now+64000),f.service.tick(f.now+64000)]);
    const result=await f.status();
    expect(result.status).toBe(Status.FINISHED); expect(result.finishReason).toBe('DISCONNECT_FORFEIT'); expect(String(result.winnerId)).toBe(f.ids[1]);
    expect(await f.history.countDocuments({matchId:f.matchId})).toBe(2);
    expect((await pool.query('SELECT count(*)::int AS n FROM public.outbox_events WHERE aggregate_id=ANY($1::uuid[])',[f.ids])).rows[0].n).toBe(2);
    await f.reconnect(); expect((await f.status()).status).toBe(Status.FINISHED);
  });
  it('T05: both disconnected deadlines cancel without any rating history or learning rewards', async () => {
    const f = await fixture(); await f.disconnect(0); await f.disconnect(1); await f.tick(4000); await f.tick(64000);
    expect((await f.status()).status).toBe(Status.CANCELLED);
    expect(await f.history.countDocuments({matchId:f.matchId})).toBe(0);
    expect((await f.profiles.find({userId:{$in:f.ids}})).map(p=>p.rating)).toEqual([1000,1000]);
    expect((await f.rounds.finishedEvent(f.matchId)).data).toMatchObject({cancelled:true,isDraw:true,finishReason:'BOTH_DISCONNECTED'});
  });
  it('T06/T07: handles a timeout before pause and preserves the remaining resolved transition', async () => {
    const f = await fixture();
    await f.questions.updateOne({_id:f.questionId},{$set:{startedAt:new Date(f.now-28000)}});
    await f.disconnect(); await f.tick(4000);
    const snapshot=await f.service.snapshot(f.matchId);
    expect(snapshot.phase).toBe('QUESTION_RESOLVED_TRANSITION');
    expect(snapshot.resolved.timedOut).toBe(true);
    expect((await f.status()).currentQuestionIndex).toBe(1);
    await f.tick(10000); await f.reconnect(); await f.sync(); await f.tick(10000); await f.tick(13000);
    await f.rounds.advanceTo(f.matchId,f.now+14000);
    expect((await f.status()).currentQuestionIndex).toBe(1);
    await f.rounds.advanceTo(f.matchId,f.now+15000);
    expect((await f.status()).currentQuestionIndex).toBe(2);
  });
  it('T10: reconnect at the exact deadline is accepted', async () => {
    const f=await fixture(); await f.disconnect(); await f.tick(4000);
    await f.tick(63000); await f.reconnect(); await f.sync(); await f.tick(63000);
    expect((await f.status()).status).toBe(Status.RESUMING);
  });
  it('rejects an answer after grace even if the scheduler has not applied PAUSED yet', async () => {
    const f=await fixture(); await f.disconnect(); vi.setSystemTime(f.now+4000);
    await expect(f.submit()).rejects.toThrow('paused');
    expect(await f.rounds.advanceTo(f.matchId,f.now+4000)).toEqual([]);
    await f.tick(4000); expect((await f.status()).status).toBe(Status.PAUSED);
  });
  it('T11/T18: a new pause beyond the player limit forfeits and cannot add unlimited time', async () => {
    const f=await fixture({maxPauseCount:1,resumeCountdownSeconds:0});
    await f.disconnect(); await f.tick(4000); await f.reconnect(); await f.sync(); await f.tick(4000);
    await f.disconnect(); await f.tick(8000); await f.tick(8001);
    expect((await f.status()).finishReason).toBe('DISCONNECT_FORFEIT');
  });
  it('T14: a new service instance restores the persisted pause deadline after restart', async () => {
    const f=await fixture(); await f.disconnect(); await f.tick(4000);
    const recovered = new ArenaRankedConnectionService(f.matches,f.players,f.questions,f.answers,{isOnline:async(id:string)=>f.online.has(id)} as any,f.rounds,f.matchService,new ArenaMatchTransactions(createConnection(pool)));
    expect((await recovered.snapshot(f.matchId)).remainingMs).toBe(27000);
    await recovered.tick(f.now+64000);
    expect((await f.status()).status).toBe(Status.FINISHED);
  });
  it('T13: match creation snapshots the current admin rules and later edits only affect new matches', async () => {
    const f = await fixture(), config = structuredClone(ARENA_DEFAULTS);
    const redis = { getClient: () => ({ set: async () => 'OK', eval: async () => 1 }) };
    const service = new ArenaMatchService(redis as any,f.matches,f.players,f.profiles,f.history,{} as any,new ArenaRatingService(),f.rooms,{requireEnabled:async()=>config} as any);
    const create = async () => {
      const ids = [String(new PgId()),String(new PgId())]; userIds.push(...ids);
      for(const id of ids) await f.profiles.create({userId:new PgId(id),rating:1000});
      const created = await service.createMatch(ids[0],ids[1]);
      matchIds.push(String(created.match._id)); return created.match;
    };
    const first = await create();
    config.rankedConnection.disconnectTimeoutSeconds=30;
    config.hints.maxPercent=60;
    const second = await create();
    expect((await f.matches.findById(first._id))?.runtimePolicy?.rankedConnection?.disconnectTimeoutSeconds).toBe(60);
    expect(second.runtimePolicy.rankedConnection.disconnectTimeoutSeconds).toBe(30);
    expect((await f.matches.findById(first._id))?.runtimePolicy?.hints?.maxPercent).toBe(30);
    expect(second.runtimePolicy.hints.maxPercent).toBe(60);
  });
  it('uses the same hint policy for live events, reconnect snapshots and a paused question', async () => {
    const f=await fixture();
    const match=await f.status();
    await f.matches.updateOne({_id:match._id},{$set:{runtimePolicy:{...match.runtimePolicy,hints:{startAfterSeconds:2,intervalSeconds:1,maxPercent:60}}}});
    vi.setSystemTime(f.now+4500);
    const events=await f.rounds.advanceTo(f.matchId,f.now+4500);
    const letters=events.find(e=>e.event==='match:hint')!.data.letters;
    expect(letters).toEqual(['a',null,'p',null,'e']);
    expect((await f.service.snapshot(f.matchId)).question.letters).toEqual(letters);
    await f.disconnect(); await f.tick(8000);
    expect((await f.service.snapshot(f.matchId)).question.letters).toEqual(letters);
    await f.tick(18000);
    expect((await f.service.snapshot(f.matchId)).question.letters).toEqual(letters);
  });
  it('enforces the total pause budget independently of the count limit', async () => {
    const f = await fixture({disconnectTimeoutSeconds:10,maxTotalPauseSeconds:10,resumeCountdownSeconds:0,maxPauseCount:10});
    await f.disconnect(); await f.tick(4000); await f.tick(12000); await f.reconnect(); await f.sync(); await f.tick(12000);
    await f.disconnect(); await f.tick(16000);
    const state = (await f.status()).rankedState!;
    expect(state.members[f.ids[0]].pausedMs).toBe(9000);
    expect(state.members[f.ids[0]].deadlineAt).toBe(f.now+16000);
    await f.tick(16001);
    expect((await f.status()).finishReason).toBe('DISCONNECT_FORFEIT');
  });
  it('restores submitted answers privately without exposing an opponent answer', async () => {
    const f = await fixture();
    await f.rounds.submitAnswer({matchId:f.matchId,questionId:String(f.questionId),userId:f.ids[0],answer:'wrong'});
    expect((await f.service.snapshot(f.matchId,f.ids[0])).submitted.answer).toBe('wrong');
    expect((await f.service.snapshot(f.matchId,f.ids[1])).submitted).toBeNull();
    expect(await f.service.snapshot(f.matchId)).not.toHaveProperty('submitted');
    await expect(f.service.snapshot(f.matchId,String(new PgId()))).rejects.toThrow('not a player');
  });
  it('keeps submit/advance/finalize transactional across an entire ranked round and opens optional timestamps', async () => {
    const f=await fixture();
    for(let order=1;order<=3;order++){
      const q=await f.questions.findOne({matchId:f.matchId,order});
      const at=f.now+(order-1)*5000; vi.setSystemTime(at);
      await f.rounds.advanceTo(f.matchId,at);
      await f.rounds.submitAnswer({matchId:f.matchId,questionId:String(q!._id),userId:f.ids[0],answer:'apple'});
      await f.questions.updateOne({_id:q!._id},{$set:{resolvedAt:new Date(at-3001)}});
      await f.rounds.advanceTo(f.matchId,at);
    }
    expect((await f.status()).status).toBe(Status.FINISHED);
    expect((await f.players.findOne({matchId:f.matchId,userId:f.ids[0]}))?.correctAnswers).toBe(3);
    expect(await f.history.countDocuments({matchId:f.matchId})).toBe(2);
  });
});
