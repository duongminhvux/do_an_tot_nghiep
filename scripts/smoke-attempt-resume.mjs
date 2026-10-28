/** Read-only verification inside Identity: node scripts/smoke-attempt-resume.mjs ATTEMPT_UUID OWNER_UUID */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const {Pool}=require('pg'),{JwtService}=require('@nestjs/jwt');
const id=process.argv[2];
assert.match(id||'',/^[a-f0-9-]{36}$/i,'Pass the saved attempt UUID');
const userId=process.argv[3];
assert.match(userId||'',/^[a-f0-9-]{36}$/i,'Pass the attempt owner UUID as the second argument');
const source=await fetch(`${process.env.ASSESSMENT_INTERNAL_URL}/api/_internal/assessment/attempts`,{
  method:'POST',headers:{'x-internal-token':process.env.INTERNAL_SERVICE_TOKEN,'content-type':'application/json'},
  body:JSON.stringify({ids:[id],userId,limit:1}),signal:AbortSignal.timeout(8000)});
assert.equal(source.status,200);
const projection=await source.json();
const row=(projection.data??projection).find(row=>row.id===id);
assert(row,'Saved attempt not found');
assert.equal(row.mode,'PRACTICE','Use a practice attempt so the read cannot auto-submit an expired test');
const snapshot=row.questionSnapshot;
assert(snapshot?.length,'This check requires an existing snapshot');
const pool=new Pool();
try {
  const active=await pool.query('SELECT id FROM users WHERE id=$1 AND is_deleted=false AND COALESCE(is_banned,false)=false',[userId]);
  assert(active.rows[0],'Attempt owner must be active');
  const token=await new JwtService().signAsync({_id:userId,role:'USER'},{secret:process.env.JWT_ACCESS_SECRET,expiresIn:'2m'});
  const response=await fetch(`http://gateway:5000/api/attempts/${id}`,{headers:{authorization:`Bearer ${token}`}});
  const body=await response.json();
  assert.equal(response.status,200,body.message);
  assert.equal(body.data.questions.length,snapshot.length);
  assert.equal(body.data.status,row.status);
  assert.deepEqual(body.data.answers,row.answers||{});
  console.log(`200 GET /api/attempts/${id}; ${snapshot.length} saved question(s), original answers retained`);
} finally {await pool.end();}
