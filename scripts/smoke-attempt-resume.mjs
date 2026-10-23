/** Read-only verification of a saved PRACTICE attempt, run inside Identity. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const {Pool}=require('pg'),{JwtService}=require('@nestjs/jwt');
const id=process.argv[2];
assert.match(id||'',/^[a-f0-9-]{36}$/i,'Pass the saved attempt UUID');
const source=await fetch(`${process.env.ASSESSMENT_INTERNAL_URL}/api/_internal/read-models/attempts`,{headers:{'x-internal-token':process.env.INTERNAL_SERVICE_TOKEN}});
assert.equal(source.status,200);
const row=(await source.json()).data.find(row=>row.id===id);
assert(row,'Saved attempt not found');
const stored={...row.payload,...Object.fromEntries(Object.entries(row).filter(([key])=>key!=='payload'))};
assert.equal(row.payload?.mode,'PRACTICE','Use a practice attempt so the read cannot auto-submit an expired test');
const snapshot=row.payload?.questionSnapshot||row.question_snapshot;
assert(snapshot?.length,'This check requires an existing snapshot');
const userId=row.user_id||row.payload?.userId;
const pool=new Pool();
try {
  const active=await pool.query('SELECT id FROM users WHERE id=$1 AND is_deleted=false AND COALESCE(is_banned,false)=false',[userId]);
  assert(active.rows[0],'Attempt owner must be active');
  const token=await new JwtService().signAsync({_id:userId,role:'USER'},{secret:process.env.JWT_ACCESS_SECRET,expiresIn:'2m'});
  const response=await fetch(`http://gateway:5000/api/attempts/${id}`,{headers:{authorization:`Bearer ${token}`}});
  const body=await response.json();
  assert.equal(response.status,200,body.message);
  assert.equal(body.data.questions.length,snapshot.length);
  assert.equal(body.data.status,stored.status);
  assert.deepEqual(body.data.answers,row.payload?.answers||row.answers||{});
  console.log(`200 GET /api/attempts/${id}; ${snapshot.length} saved question(s), original answers retained`);
} finally {await pool.end();}
