import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../test/native-database.js';
import {arenaFixture} from '../../../test/arena-fixture.js';
import {sql,rows} from '../../postgres/sql.js';
const suite=databaseSuite('arena');
afterEach(()=>vi.unstubAllGlobals());
import {arenaPeriodStart} from './arena-read.service.js';
import {arenaTodayRange} from './arena.service.js';
describe('Arena native reads',()=>{
 it('does not rank profiles without completed matches',async()=>{const f=await arenaFixture(suite);await f.arena.getOrCreateProfile(f.users[0]);expect((await f.read.getLeaderboard(f.users[0],'all')).totalPlayers).toBe(0);});
 it('counts ranked wins, draws and streaks from completed matches',async()=>{
   const f=await arenaFixture(suite);for(const won of [true,false,true,true]){const m=await f.match();await suite.records('arenamatchplayers').patch(sql`match_id=${m._id}::uuid AND user_id=${f.users[won?0:1]}::uuid`,{score:100});await f.matches.finishMatch(m._id);}
   expect(await f.read.getRankedStatistics(f.users[0])).toMatchObject({matches:4,wins:3,losses:1,currentWinStreak:2,bestWinStreak:2});const board=await f.read.getLeaderboard(f.users[0],'all',1);expect(board.totalPlayers).toBe(2);expect(board.me).toBeTruthy();expect((await f.read.getRecentMatches(f.users[0],10))).toHaveLength(4);
 });
 it('rejects invalid IDs and limits before executing SQL',async()=>{const f=await arenaFixture(suite);expect(()=>f.read.getRecentMatches('bad')).toThrow();for(const limit of [0,51,-1,1.5])expect(()=>f.read.getRecentMatches(f.users[0],limit)).toThrow();});
});
describe('Arena calendar periods in Vietnam', () => {
  it('changes the Elo day at Vietnamese midnight instead of the host timezone', () => {
    expect(
      arenaTodayRange(new Date('2026-10-14T16:59:59Z')).start.toISOString(),
    ).toBe('2026-10-13T17:00:00.000Z');
    const range = arenaTodayRange(new Date('2026-10-14T17:00:00Z'));
    expect(range.start.toISOString()).toBe('2026-10-14T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-10-15T17:00:00.000Z');
  });
  it('starts the week on Monday at local midnight, including UTC Sunday', () => {
    expect(
      arenaPeriodStart('week', new Date('2026-10-11T18:00:00Z'))?.toISOString(),
    ).toBe('2026-10-11T17:00:00.000Z');
    expect(
      arenaPeriodStart('week', new Date('2026-10-11T16:00:00Z'))?.toISOString(),
    ).toBe('2026-10-04T17:00:00.000Z');
  });
  it('starts the month at local midnight and leaves all-time unrestricted', () => {
    expect(
      arenaPeriodStart(
        'month',
        new Date('2026-09-30T18:00:00Z'),
      )?.toISOString(),
    ).toBe('2026-09-30T17:00:00.000Z');
    expect(arenaPeriodStart('all')).toBeUndefined();
  });
});
