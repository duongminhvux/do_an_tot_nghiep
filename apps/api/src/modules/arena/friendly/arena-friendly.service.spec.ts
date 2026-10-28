import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {arenaFixture} from '../../../../test/arena-fixture.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('arena');
afterEach(()=>vi.unstubAllGlobals());
describe('Friendly native Word Chain and Word Guess',()=>{
 it('normalizes a word, checks dictionary membership and switches the turn once',async()=>{
   const f=await arenaFixture(suite),m=await f.match({type:'FRIEND',friendMode:'WORD_CHAIN',hostId:f.users[0],currentTurnUserId:f.users[0],currentWord:'apple',usedWords:['apple'],turnCount:1,turnDeadline:new Date(Date.now()+20000)});
   const events=await f.friendly.submit(m._id,f.users[0],'  ELEPHANT  ');expect(events.some(e=>e.event==='word-chain:accepted')).toBe(true);
   const saved=await f.savedMatch(m._id);expect(saved?.usedWords).toEqual(['apple','elephant']);expect(saved?.currentTurnUserId).toBe(f.users[1]);expect(saved?.turnCount).toBe(2);
   expect((await f.friendly.submit(m._id,f.users[0],'tiger'))[0].data.reason).toBe('NOT_YOUR_TURN');
 });
 it('checks the turn deadline again after slow dictionary lookup',async()=>{
   const f=await arenaFixture(suite),m=await f.match({type:'FRIEND',friendMode:'WORD_CHAIN',currentTurnUserId:f.users[0],currentWord:'apple',usedWords:['apple'],turnCount:1,turnDeadline:new Date(Date.now()+20000)});
   f.lookup.mockImplementationOnce(async()=>{await suite.records('arenamatches').patch(sql`id=${m._id}::uuid`,{turnDeadline:new Date(Date.now()-1)});return [{_id:randomUUID(),word:'elephant'}];});
   expect((await f.friendly.submit(m._id,f.users[0],'elephant'))[0].data.reason).toBe('TURN_EXPIRED');expect((await f.savedMatch(m._id))?.usedWords).toEqual(['apple']);
 });
 it('keeps the secret private and enforces five guesses per user',async()=>{
   const f=await arenaFixture(suite),m=await f.match({type:'FRIEND',friendMode:'WORD_GUESS',hostId:f.users[0],wordGuessAnswer:'apple'});
   expect(JSON.stringify(await f.friendly.snapshot(m._id,f.users[0]))).not.toContain('apple');
   for(const word of ['chair','table','river','tiger','thumb'])await f.friendly.submitWordGuess(m._id,f.users[0],word);
   await expect(f.friendly.submitWordGuess(m._id,f.users[0],'other')).rejects.toThrow('NO_GUESSES_LEFT');expect((await f.savedMatch(m._id))?.wordGuessAttempts).toHaveLength(5);
 });
});