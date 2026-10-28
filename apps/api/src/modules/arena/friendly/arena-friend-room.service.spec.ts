import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {arenaFixture} from '../../../../test/arena-fixture.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('arena');
afterEach(()=>vi.unstubAllGlobals());
import {validateFriendSettings} from './arena-friend-room.service.js';
import {ArenaFriendMode} from '../rows/arena-match.row.js';
describe('Friendly native rooms',()=>{
 it('persists defaults, joins a guest, changes readiness and starts a match',async()=>{
   const f=await arenaFixture(suite),room=await f.rooms.create(f.users[0]);await f.rooms.join(f.users[1],room.code);await f.rooms.ready(room.roomId,f.users[1],true);
   const started=await f.rooms.start(room.roomId,f.users[0]);expect(started).toBeTruthy();const saved=await suite.records('friendrooms').one(sql`id=${room.roomId}::uuid`);expect(saved?.status).toBe('IN_MATCH');expect(saved?.matchCount).toBe(1);
 });
 it('atomically admits only one guest in a two-player room',async()=>{
   const f=await arenaFixture(suite),room=await f.rooms.create(f.users[0]);const result=await Promise.allSettled(f.users.slice(1).map(user=>f.rooms.join(user,room.code)));expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 });
 it('rejects spectators, duplicate joins and unsupported settings',async()=>{
   const f=await arenaFixture(suite),room=await f.rooms.create(f.users[0]);await expect(f.rooms.member(room.roomId,f.users[1])).rejects.toThrow();await f.rooms.join(f.users[1],room.code);await expect(f.rooms.join(f.users[1],room.code)).rejects.toThrow();expect(()=>validateFriendSettings(ArenaFriendMode.WORD_GUESS,{turnTime:10})).toThrow();
 });
 it('stores group members and readiness in JSONB without overwriting another member',async()=>{
   const f=await arenaFixture(suite),room=await f.rooms.create(f.users[0],ArenaFriendMode.CLASSIC,{},3);for(const user of f.users.slice(1))await f.rooms.join(user,room.code);
   for(const user of f.users.slice(1))await f.rooms.ready(room.roomId,user,true);const saved=await suite.records('friendrooms').one(sql`id=${room.roomId}::uuid`);expect(saved?.members.every((m:any)=>m.isReady)).toBe(true);expect(saved?.members).toHaveLength(2);
 });
});