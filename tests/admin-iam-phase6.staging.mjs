/** Real Compose/PostgreSQL/RabbitMQ/SMTP/Nginx integration; sandbox recipients only. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {db,req,http,waitFor,mailFor,tokenFromMail,compose,docker,stageEnv,project} from '../scripts/admin-iam-stage-lib.mjs';
const identity=await db('identity'),notification=await db('notification'),results=[];
const prefix='p6'+Date.now().toString(36),password='Stage-Shadow-Password123!';
const step=async(name,work)=>{await work();results.push({name,pass:true});console.log('PASS:',name);};
const login=async(username,secret)=>{const res=await http('/api/admin/auth/login',{method:'POST',body:{username,password:secret}});assert.equal(res.status,201,'Admin login failed');return res.data;};
const messageCount=async email=>{const list=await (await fetch('http://127.0.0.1:57825/api/v1/messages')).json();return list.messages.filter(item=>item.To?.some(to=>to.Address===email)).length;};
const broker=async(path,method='GET',body)=>{const res=await fetch('http://127.0.0.1:57673/api/'+path,{method,headers:{Authorization:'Basic '+Buffer.from('iamstage:'+stageEnv.RABBITMQ_PASSWORD).toString('base64'),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert(res.ok,'Rabbit management request failed');return res.status===204?null:res.json();};
let superToken,roleId,shadow,shadowToken,pending,pendingLink;
const create=async suffix=>{const username=prefix+'-'+suffix,email=username+'@example.test';const res=await http('/api/admin/admins',{method:'POST',token:superToken,body:{email,username,roleIds:roleId?[roleId]:[]}});assert.equal(res.status,201,'Invite failed');return {id:res.data.admin.id,email,username};};
const getJob=async id=>(await notification.query(`SELECT j.* FROM notification_email_jobs j WHERE (j.html::jsonb->>'tokenId') IN (SELECT id::text FROM unnest($1::uuid[]) AS id)`,[[id]])).rows[0];
try{
 await step('eight real services are ready behind TLS Nginx and internal routes stay blocked',async()=>{
  for(const role of ['identity','content','assessment','learning','arena','media-jobs','ai-import','notification'])assert.equal((await http('/gateway/'+role+'-ready')).status,200,role+' not ready');
  assert.equal((await http('/api/_internal/identity/introspect',{method:'POST',body:{}})).status,404); // Nginx private route contract: scripts/smoke-network.mjs
  superToken=(await login('stage-super','Stage-Super-Password123!')).accessToken;
  const me=await http('/api/admin/auth/me',{token:superToken});assert.equal(me.data.role,'ADMIN');assert.equal(me.data.isSuperAdmin,true);assert.equal(me.data.permissions.length,70);
 });
 await step('Super Admin creates a role and persists exact permissions',async()=>{
  const role=await http('/api/admin/roles',{method:'POST',token:superToken,body:{code:prefix.toUpperCase()+'_EDITOR',name:'Staging editor',description:'Real Compose integration'}});assert.equal(role.status,201);roleId=role.data.id;
  assert.equal((await http('/api/admin/roles/'+roleId+'/permissions',{method:'PUT',token:superToken,body:{permissionCodes:['users.read','vocabulary.read','toeic.read','dictation.read','arena.read']}})).status,200);
  const matrix=await http('/api/admin/roles/matrix',{token:superToken});assert.equal(matrix.data.grants.filter(g=>g.roleId===roleId).length,5);
 });
 await step('real outbox to Rabbit inbox/job/SMTP delivers activation and pending cannot login',async()=>{
  shadow=await create('shadow');assert.equal((await http('/api/admin/auth/login',{method:'POST',body:{username:shadow.username,password}})).status,401);
  const mail=await waitFor(()=>mailFor(shadow.email),'SMTP sandbox delivery');const raw=tokenFromMail(mail);assert(raw,'Missing activation link');
  assert.equal((await http('/api/admin/activation/status',{method:'POST',body:{token:raw}})).status,201);
  assert.equal((await http('/api/admin/activation/activate',{method:'POST',body:{token:raw,password,confirmPassword:password}})).status,201);
  assert.equal((await http('/api/admin/activation/activate',{method:'POST',body:{token:raw,password,confirmPassword:password}})).status,400);
  shadowToken=(await login(shadow.username,password)).accessToken;
 });
 await step('business services use real introspection; learner auth and four module reads regress cleanly',async()=>{
  for(const path of ['/api/admin/users','/api/admin/words','/api/admin/exams','/api/admin/dictation','/api/admin/arena/dashboard'])assert.equal((await http(path,{token:shadowToken})).status,200,path);
  assert.equal((await http('/api/admin/admins',{token:shadowToken})).status,403);
  assert.equal((await http('/api/admin/users',{method:'POST',token:shadowToken,body:{email:'blocked@example.test',name:'Blocked',password}})).status,403);
  const learner=await http('/api/auth/login',{method:'POST',body:{email:'learner@example.test',password:'Stage-Super-Password123!'}});assert.equal(learner.status,201);assert.equal(JSON.parse(Buffer.from(learner.data.accessToken.split('.')[1],'base64url')).role,'USER');
  for(const path of ['/api/exams','/api/dictation','/api/collections','/api/arena/profile'])assert.equal((await http(path,{token:learner.data.accessToken})).status,200,path);
 });
 await step('online role revocation, lock/unlock and logout never resurrect old JWTs',async()=>{
  const old=shadowToken;
  assert.equal((await http('/api/admin/roles/'+roleId+'/permissions',{method:'PUT',token:superToken,body:{permissionCodes:['vocabulary.read']}})).status,200);
  assert.equal((await http('/api/admin/words',{token:old})).status,401);shadowToken=(await login(shadow.username,password)).accessToken;
  assert.equal((await http('/api/admin/users',{token:shadowToken})).status,403);assert.equal((await http('/api/admin/words',{token:shadowToken})).status,200);
  assert.equal((await http('/api/admin/admins/'+shadow.id+'/status',{method:'PATCH',token:superToken,body:{status:'SUSPENDED'}})).status,200);
  assert.equal((await http('/api/admin/auth/me',{token:shadowToken})).status,401);
  assert.equal((await http('/api/admin/admins/'+shadow.id+'/status',{method:'PATCH',token:superToken,body:{status:'ACTIVE'}})).status,200);
  assert.equal((await http('/api/admin/auth/me',{token:shadowToken})).status,401);shadowToken=(await login(shadow.username,password)).accessToken;
  assert.equal((await http('/api/admin/auth/logout',{method:'POST',token:shadowToken})).status,201);assert.equal((await http('/api/admin/auth/me',{token:shadowToken})).status,401);
 });
 await step('reinvite invalidates the previous emailed link',async()=>{
  pending=await create('reinvite');pendingLink=tokenFromMail(await waitFor(()=>mailFor(pending.email),'first invite'));
  assert.equal((await http('/api/admin/admins/'+pending.id+'/reinvite',{method:'POST',token:superToken})).status,429);
  await identity.query("UPDATE admin_activation_tokens SET created_at=created_at-interval '61 seconds',expires_at=expires_at-interval '61 seconds' WHERE admin_id=$1",[pending.id]);
  assert.equal((await http('/api/admin/admins/'+pending.id+'/reinvite',{method:'POST',token:superToken})).status,201);
  assert.equal((await http('/api/admin/activation/status',{method:'POST',body:{token:pendingLink}})).status,400);
  await waitFor(async()=>await messageCount(pending.email)>=2,'second SMTP invitation');
 });
 await step('transport duplicate and logical duplicate through Rabbit do not resend mail',async()=>{
  const event=(await identity.query("SELECT * FROM outbox_events WHERE aggregate_id=$1 AND event_type='identity.admin.activation_email_requested.v1' ORDER BY created_at LIMIT 1",[shadow.id])).rows[0];
  const eventBody={eventId:event.event_id,type:event.event_type,payload:event.payload,source:'identity',aggregateId:shadow.id,occurredAt:event.created_at.toISOString()};const before=await messageCount(shadow.email);
  for(const eventId of [event.event_id,event.event_id,randomUUID()])await broker('exchanges/%2F/domain.events/publish','POST',{properties:{delivery_mode:2,content_type:'application/json'},routing_key:event.event_type,payload:JSON.stringify({...eventBody,eventId}),payload_encoding:'string'});
  await waitFor(async()=>Number((await notification.query('SELECT count(*) FROM inbox_events WHERE consumer_name=$1 AND event_id=$2',['notification',event.event_id])).rows[0].count)===1,'deduped receipt');
  assert.equal(await messageCount(shadow.email),before);assert.equal(Number((await notification.query('SELECT count(*) FROM notification_email_jobs WHERE id=$1',[event.payload.tokenId])).rows[0].count),1);
 });
 await step('RabbitMQ downtime leaves the invitation in durable outbox and recovery sends it',async()=>{
  compose('stop','rabbitmq');const invite=await create('rabbitdown');
  assert.equal((await identity.query("SELECT published_at FROM outbox_events WHERE aggregate_id=$1 AND event_type='identity.admin.activation_email_requested.v1'",[invite.id])).rows[0].published_at,null);
  compose('start','rabbitmq');await waitFor(()=>mailFor(invite.email),'broker reconnect SMTP',60000);
 });
 await step('SMTP downtime retries with backoff then succeeds',async()=>{
  compose('stop','mailpit');const invite=await create('smtpdown');const tid=(await identity.query('SELECT id FROM admin_activation_tokens WHERE admin_id=$1',[invite.id])).rows[0].id;
  const job=await waitFor(async()=>{const row=(await notification.query('SELECT * FROM notification_email_jobs WHERE id=$1',[tid])).rows[0];return row?.last_error==='DELIVERY_UNAVAILABLE'?row:false;},'SMTP retry recorded');assert.equal(job.state,'pending');assert(job.attempts>=1);
  compose('start','mailpit');await waitFor(()=>mailFor(invite.email),'SMTP recovered',45000);
 });
 await step('real notification worker crash leaves an active lease and another run recovers it',async()=>{
  docker(['pause',project+'-mailpit-1']);const invite=await create('crash');const tid=(await identity.query('SELECT id FROM admin_activation_tokens WHERE admin_id=$1',[invite.id])).rows[0].id;
  await waitFor(async()=>{const row=(await notification.query('SELECT state FROM notification_email_jobs WHERE id=$1',[tid])).rows[0];return row?.state==='active';},'active lease before crash');
  compose('kill','-s','SIGKILL','notification-service');docker(['unpause',project+'-mailpit-1']);
  assert.equal((await notification.query('SELECT state FROM notification_email_jobs WHERE id=$1',[tid])).rows[0].state,'active');
  await notification.query("UPDATE notification_email_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[tid]);compose('start','notification-service');
  await waitFor(()=>mailFor(invite.email),'crash lease recovery',45000);
 });
 await step('consumer transaction failure really uses Rabbit retry queue and recovers',async()=>{
  const admin=JSON.parse(docker(['inspect',project+'-postgres-1']))[0];assert.equal(admin.Config.Labels['vocalearn.purpose'],'admin-iam-phase6-staging');
  const pgSql=text=>docker(['exec','-i',project+'-postgres-1','psql','-U','iam_stage','-d','notification_db','-v','ON_ERROR_STOP=1'],{input:text});
  pgSql('REVOKE INSERT ON notification_email_jobs FROM vl_notification;');const invite=await create('retryqueue');
  await waitFor(async()=>{const queue=await broker('queues/%2F/notification.retry-v2');return queue.messages_ready>=1;},'real Rabbit retry queue');
  pgSql('GRANT INSERT ON notification_email_jobs TO vl_notification;');await waitFor(()=>mailFor(invite.email),'retried event delivery',45000);
 });
 await step('malformed contract is dead-lettered by the real consumer without inbox commit',async()=>{
  const eventId=randomUUID();await identity.query("INSERT INTO outbox_events(event_id,event_type,aggregate_type,aggregate_id,payload) VALUES($1,'identity.admin.activation_email_requested.v1','iam-test',$2,'{}')",[eventId,shadow.id]);
  await waitFor(async()=>Number((await notification.query('SELECT count(*) FROM event_processing_failures WHERE event_id=$1 AND consumer_name=$2',[eventId,'notification'])).rows[0].count)===1,'DLQ failure persisted');
  await waitFor(async()=>{const q=await broker('queues/%2F/notification.dead-v2');return q.messages_ready>=1;},'real dead queue');
  assert.equal(Number((await notification.query('SELECT count(*) FROM inbox_events WHERE event_id=$1 AND consumer_name=$2',[eventId,'notification'])).rows[0].count),0);
 });
 await step('audit is projected through Rabbit, protected by audit.read, and contains no credential fields',async()=>{
  await waitFor(async()=>Number((await notification.query("SELECT count(*) FROM activitylogs WHERE action='ADMIN_ACTIVATED'")).rows[0].count)>0,'activation audit');
  const logs=await http('/api/admin/activity-logs?limit=100',{token:superToken});assert.equal(logs.status,200);
  assert.equal((await http('/api/admin/activity-logs',{token:(await login(shadow.username,password)).accessToken})).status,403);
  const stored=(await notification.query("SELECT metadata FROM activitylogs WHERE action='ADMIN_ACTIVATED'")).rows;assert(!JSON.stringify(stored).includes('password_hash'));assert(!JSON.stringify(stored).includes('rawToken'));
 });
 await step('real Identity outage fails closed in a business service and recovery restores authorization',async()=>{
  try{compose('stop','identity-service');assert.equal((await http('/api/admin/words',{token:superToken})).status,503);}
  finally{compose('start','identity-service');await waitFor(async()=> (await http('/gateway/identity-ready')).status===200,'Identity ready after outage',45000);}
  assert.equal((await http('/api/admin/words',{token:superToken})).status,200);
 });
 writeFileSync('.tmp/admin-iam-phase6/staging-e2e-results.json',JSON.stringify({at:new Date().toISOString(),project,results,realPostgres:true,realRabbitMq:true,realSmtpSink:true,gateway:'TLS Nginx',productionChanged:false},null,2));console.log('STAGING PASS:',results.length,'scenarios');
}finally{await identity.end();await notification.end();}
