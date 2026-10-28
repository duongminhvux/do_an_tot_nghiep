import {describe,it,expect} from 'vitest';
import {dashboardPeriod} from './dashboard-period.js';
import {readDashboard} from './dashboard-reader.js';
import {databaseSuite} from '../../../test/native-database.js';
const suite=databaseSuite('identity');
describe('Dashboard Vietnam calendar and authoritative Identity reads',()=>{
  it('uses Vietnam midnight and calendar labels even when UTC is still the previous date',()=>{
    const period=dashboardPeriod(7,new Date('2026-10-28T18:30:00Z'));
    expect(period.labels).toHaveLength(7);expect(period.labels[6]).toBe('2026-10-29');
    expect(period.start).toBe('2026-10-22T17:00:00.000Z');expect(period.previousStart).toBe('2026-10-15T17:00:00.000Z');
    expect(dashboardPeriod(NaN).days).toBe(7);expect(dashboardPeriod(999).days).toBe(90);
  });
  it('counts native user timestamps from Identity, not stale legacy payload creation dates',async()=>{
    await suite.db.query(`INSERT INTO users(email,username,created_at,payload) VALUES('old@example.test','Old','2026-09-19T00:00:00Z','{"createdAt":"2026-10-28T18:00:00Z"}'),('new@example.test','New','2026-10-28T18:00:00Z','{}')`);
    const result=await readDashboard(suite.db,'identity',dashboardPeriod(7,new Date('2026-10-28T18:30:00Z')));
    expect(result.totalUsers).toBe(2);expect(result.previousUsers).toBe(1);
    expect(result.userTimeline).toEqual([{_id:'2026-10-29',count:1}]);
    expect(result.newUsers[0]).toMatchObject({username:'New'});
  });
});
