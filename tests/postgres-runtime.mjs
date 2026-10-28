/** Run against an isolated learning database. Every fixture rolls back. */
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const {Pool}=require('pg');
const {createConnection}=await import('../apps/api/dist/postgres/connection.js');
const {SqlRecords}=await import('../apps/api/dist/postgres/records.js');
const {sql,rows}=await import('../apps/api/dist/postgres/sql.js');
assert.equal(process.env.SERVICE_ROLE,'learning','Run in learning-service');
const pool=new Pool(),client=await pool.connect(),db=createConnection(client);
try{
  await client.query('BEGIN');
  const games=new SqlRecords(db,'gamedefinitions'),code=`SMOKE_${randomUUID()}`;
  const game=await games.insert({code,name:'Native JSONB fixture',destination:'/smoke',category:'SOLO',badge:'FEATURED',settings:{lives:3}});
  assert.deepEqual(game.settings,{lives:3});
  await games.patch(sql`code=${code}`,{category:'MULTIPLAYER',badge:null});
  assert.equal((await games.one(sql`code=${code}`)).badge,null);
  const activities=new SqlRecords(db,'learning_activities'),userId=randomUUID();
  for(const [key,xp,at,score]of [['first',10,'2026-10-23T18:00:00Z',500],['second',20,'2026-10-24T01:00:00Z',700]])
    await activities.insert({userId,module:'VOCABULARY',type:'VOCAB_SESSION',sourceKey:key,xp,occurredAt:new Date(at),score});
  const totals=await rows(db,sql`SELECT TO_CHAR(occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') day,SUM(xp)::int xp,AVG(score)::float8 average FROM learning_activities WHERE user_id=${userId}::uuid GROUP BY 1`);
  assert.deepEqual(totals,[{day:'2026-10-24',xp:30,average:600}]);
  console.log('PASS: native JSONB scalar/null/object updates and SQL daily totals');
}finally{await client.query('ROLLBACK');client.release();await pool.end();}
