import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('arena');
import {arenaFixture} from '../../../../test/arena-fixture.js';
import {ArenaAdminService} from './arena-admin.service.js';
import {ArenaAdminQuery,ArenaPlayerQuery} from './arena-admin.dto.js';
afterEach(()=>vi.unstubAllGlobals());
describe('Arena native admin queries',()=>{
 it('returns consistent list/detail timestamps and public player projections',async()=>{
   const f=await arenaFixture(suite),m=await f.match();await f.matches.finishMatch(m._id);
   const admin=new ArenaAdminService(suite.db,f.presence as never,f.rooms,{} as never,f.settings,{} as never,f.read);
   const list=await admin.matchList(new ArenaAdminQuery()),detail=await admin.matchDetail(m._id);expect(list.items[0].duration).toBe(detail.duration);expect(detail.players[0].user.username).toBeTruthy();expect(detail.players[0].user).not.toHaveProperty('email');
 });
 it.each(['rating','rankedMatches','winRate','lastActivity'])('filters names before pagination and orders by %s',async(sort)=>{
   const f=await arenaFixture(suite);for(const user of f.users)await f.arena.getOrCreateProfile(user);
   const admin=new ArenaAdminService(suite.db,f.presence as never,f.rooms,{} as never,f.settings,{} as never,f.read);
   const query=Object.assign(new ArenaPlayerQuery(),{search:'Player 1',limit:1,sort});const result=await admin.playerList(query);expect(result.total).toBe(1);expect(result.items[0].user.username).toBe('Player 1');
 });
});