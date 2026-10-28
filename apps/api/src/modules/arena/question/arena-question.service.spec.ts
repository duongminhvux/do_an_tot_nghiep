import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {arenaFixture} from '../../../../test/arena-fixture.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('arena');
afterEach(()=>vi.unstubAllGlobals());
describe('Arena native question snapshots',()=>{
 it('samples distinct words, stores meaning metadata and reuses snapshots',async()=>{const f=await arenaFixture(suite),m=await f.match();const first=await f.questions.createRankedQuestions(m._id,2);expect(first).toHaveLength(2);expect(await f.questions.createRankedQuestions(m._id,2)).toEqual(first);expect(await suite.records('arenamatchquestions').count()).toBe(2);});
 it('rejects insufficient vocabulary without writing partial rows',async()=>{const f=await arenaFixture(suite),m=await f.match();vi.stubGlobal('fetch',async()=>({ok:true,json:async()=>({data:[]})}));await expect(f.questions.createRankedQuestions(m._id,3)).rejects.toThrow();expect(await suite.records('arenamatchquestions').count()).toBe(0);});
});