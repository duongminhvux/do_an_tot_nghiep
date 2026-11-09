/** Upload permission regression against marked synthetic staging, read-only account discovery. */
import assert from 'node:assert/strict';
import https from 'node:https';
import {db,http,base} from '../scripts/admin-iam-stage-lib.mjs';
const identity=await db('identity');
try{
 await identity.query('BEGIN READ ONLY');
 const result=await identity.query("SELECT username FROM admins WHERE username LIKE 'p6%-shadow' AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1");
 await identity.query('ROLLBACK');assert(result.rows[0],'Run Phase6 synthetic fixture suite first');
 const admin=await http('/api/admin/auth/login',{method:'POST',body:{username:result.rows[0].username,password:'Stage-Shadow-Password123!'}});assert.equal(admin.status,201);
 const learner=await http('/api/auth/login',{method:'POST',body:{email:'learner@example.test',password:'Stage-Super-Password123!'}});assert.equal(learner.status,201);
 const boundary='cropper-test-boundary',image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n'),image,Buffer.from('\r\n--'+boundary+'--\r\n')]);
 async function upload(token){return new Promise((resolve,reject)=>{const req=https.request(base+'/api/upload',{method:'POST',rejectUnauthorized:false,headers:{'content-type':'multipart/form-data; boundary='+boundary,'content-length':body.length,'x-permissions':'media.upload',...(token?{authorization:'Bearer '+token}:{})}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(body);});}
 assert.equal(await upload(admin.data.accessToken),403);assert.equal(await upload(learner.data.accessToken),403);assert.equal(await upload(),401);console.log('PASS: admin without media.upload=403, learner=403, unauthenticated=401; forged permissions header ignored');
}finally{await identity.end();}
