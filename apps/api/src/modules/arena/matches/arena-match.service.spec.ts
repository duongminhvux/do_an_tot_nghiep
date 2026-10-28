import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {arenaFixture} from '../../../../test/arena-fixture.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('arena');
afterEach(()=>vi.unstubAllGlobals());
describe('Arena native match results',()=>{
 it.each(['RANK','FRIEND','ROOM'])('finishes %s and enqueues one XP event per participant once',async(type)=>{
   const f=await arenaFixture(suite),m=await f.match({type,friendMode:type==='RANK'?null:'CLASSIC'});
   await suite.records('arenamatchplayers').patch(sql`match_id=${m._id}::uuid AND user_id=${f.users[0]}::uuid`,{score:100});
   const finished=await f.matches.finishMatch(m._id);await f.matches.finishMatch(m._id);
   expect(finished?.winnerId).toBe(f.users[0]);expect(await suite.records('outbox_events').count()).toBe(2);
   expect(await suite.records('arenaratinghistories').count()).toBe(type==='RANK'?2:0);
   const players=await suite.records('arenamatchplayers').select();expect(players.every(p=>p.status==='FINISHED')).toBe(true);
 });
 it('preserves a draw and permits a forced winner outside the first two in room mode',async()=>{
   const f=await arenaFixture(suite),draw=await f.match({type:'FRIEND'});expect((await f.matches.finishMatch(draw._id))?.isDraw).toBe(true);
   const m=await f.match({type:'ROOM',friendMode:'WORD_CHAIN'});await suite.records('arenamatchplayers').insert({matchId:m._id,userId:f.users[2],ratingBefore:1000});
   expect((await f.matches.finishMatch(m._id,undefined,f.users[2]))?.winnerId).toBe(f.users[2]);
 });
 it('rolls back the finish state and ratings if outbox persistence fails',async()=>{
   const f=await arenaFixture(suite),m=await f.match();vi.spyOn(f.outbox,'enqueue').mockRejectedValueOnce(new Error('outbox failed'));
   await expect(f.matches.finishMatch(m._id)).rejects.toThrow('outbox failed');expect((await f.savedMatch(m._id))?.status).toBe('PLAYING');expect(await suite.records('arenaratinghistories').count()).toBe(0);
 });
});