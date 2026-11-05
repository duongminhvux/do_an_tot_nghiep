/** Phase 4: real two-owner PostgreSQL + relay/consumer + internal HTTP + fake SMTP. */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module'),req=createRequire(path.resolve('apps/api/package.json'));
req('reflect-metadata');
const {Pool}=req('pg'),bcrypt=req('bcrypt'),request=req('supertest');
const {Test}=req('@nestjs/testing'),{APP_GUARD}=req('@nestjs/core');
const {Global,Module}=req('@nestjs/common'),{PassportModule}=req('@nestjs/passport'),{JwtModule,JwtService}=req('@nestjs/jwt');
const {ConfigService}=req('@nestjs/config'),{I18nService}=req('nestjs-i18n');
const load=require('./helpers/load-typescript.cjs'),src=f=>load('apps/api/src/'+f);
const {createConnection,getConnectionToken}=src('postgres/connection.ts');
const {AdminsModule}=src('modules/admins/admins.module.ts');
const {AdminAuthController}=src('modules/auth/admin-auth.controller.ts'),{AuthController}=src('modules/auth/auth.controller.ts');
const {AuthService}=src('modules/auth/auth.service.ts'),{JwtStrategy}=src('modules/auth/strategy/jwt.strategy.ts'),{LocalStrategy}=src('modules/auth/strategy/local.strategy.ts');
const {JwtAuthGuard}=src('modules/auth/guards/jwt-auth.guard.ts'),{PermissionsGuard}=src('modules/auth/guards/permissions.guard.ts');
const {UsersService}=src('modules/users/users.service.ts'),{NotificationClient}=src('common/clients/notification-client.ts');
const ids={super:'11111111-1111-4111-8111-111111111111',editor:'22222222-2222-4222-8222-222222222222',second:'33333333-3333-4333-8333-333333333333',user:'66666666-6666-4666-8666-666666666666'};

test('Phase 4 activation, outbox/inbox and email delivery with real PostgreSQL',async t=>{
 const port=Number(process.env.ADMIN_IAM_TEST_PORT);
 assert(Number.isInteger(port)&&port>1024&&port!==5432);assert(process.env.ADMIN_IAM_TEST_PASSWORD);
 const pool=new Pool({host:'127.0.0.1',port,user:'vl_identity',password:process.env.ADMIN_IAM_TEST_PASSWORD,database:'identity_db'});
 let app,notificationApp;
 const notificationPool=new Pool({host:'127.0.0.1',port,user:'vl_notification',password:process.env.ADMIN_IAM_TEST_PASSWORD,database:'notification_db'});
 const originalInternalToken=process.env.INTERNAL_SERVICE_TOKEN;
 try {
  assert.equal((await pool.query('SHOW cluster_name')).rows[0].cluster_name,'admin-iam-phase1-test');
  await pool.query('DROP SCHEMA public CASCADE');await pool.query('CREATE SCHEMA public AUTHORIZATION vl_identity');
  const {migrate}=await import('../apps/api/src/postgres/migrations.ts');await migrate(pool,'identity');
  assert.equal((await notificationPool.query('SHOW cluster_name')).rows[0].cluster_name,'admin-iam-phase1-test');
  await notificationPool.query('DROP SCHEMA public CASCADE');await notificationPool.query('CREATE SCHEMA public AUTHORIZATION vl_notification');await migrate(notificationPool,'notification');
  const digest=await bcrypt.hash('phase3-fixture-password',4);
  for(const name of ['super','editor','second'])await pool.query(`INSERT INTO public.admins(id,email,username,password_hash,status) VALUES($1,$2,$3,$4,'ACTIVE')`,[ids[name],name+'@example.test',name,digest]);
  const superRole=(await pool.query("SELECT id FROM public.roles WHERE code='SUPER_ADMIN'")).rows[0].id;
  await pool.query('INSERT INTO public.admin_roles(admin_id,role_id) VALUES($1,$2)',[ids.super,superRole]);
  const ordinary=(await pool.query("INSERT INTO public.roles(code,name) VALUES('ORDINARY','Ordinary') RETURNING id")).rows[0].id;
  await pool.query('INSERT INTO public.admin_roles(admin_id,role_id) VALUES($1,$2)',[ids.editor,ordinary]);
  const configValues={JWT_ACCESS_SECRET:'phase3-access-secret',JWT_REFRESH_SECRET:'phase3-refresh-secret',JWT_ACCESS_TOKEN_EXPIRES:'10m',JWT_REFRESH_TOKEN_EXPIRES:'1d',COOKIE_SECURE:'false',ADMIN_ACTIVATION_DELIVERY_ENABLED:'true',ADMIN_ACTIVATION_CONSUMER_READY:'true',ADMIN_ACTIVATION_TOKEN_KEY:'a'.repeat(64),ADMIN_WEB_URL:'https://admin.example.test/',INTERNAL_SERVICE_TOKEN:'test-internal-token-at-least-24-characters'};
  const config={get:key=>configValues[key],getOrThrow:key=>configValues[key]};
  process.env.INTERNAL_SERVICE_TOKEN=configValues.INTERNAL_SERVICE_TOKEN;
  const {InternalNotificationController}=src('internal/notification-internal.module.ts');
  const {ActivityLogsService}=src('modules/activity-logs/activity-logs.service.ts');
  const {GmailService}=src('modules/gmail/gmail.service.ts');
  const sent=[];let smtpDown=false;
  const notif=await Test.createTestingModule({controllers:[InternalNotificationController],providers:[{provide:ActivityLogsService,useValue:{}},{provide:GmailService,useValue:{sendEmail:async(to,subject,html)=>{if(smtpDown)throw Error('Simulated SMTP down');sent.push({to,subject,html});}}}]}).compile();
  notificationApp=notif.createNestApplication({logger:false});notificationApp.setGlobalPrefix('api');await notificationApp.listen(0,'127.0.0.1');configValues.NOTIFICATION_INTERNAL_URL=await notificationApp.getUrl();
  const learner={_id:ids.user,id:ids.user,email:'learner@example.test',username:'learner',password:digest,authProvider:'local',isVerified:true,isDeleted:false};
  class FixtureGlobals {}
  Global()(FixtureGlobals);Module({providers:[
   {provide:getConnectionToken(),useValue:createConnection(pool)},
   {provide:ConfigService,useValue:config},{provide:I18nService,useValue:{t:async k=>k,translate:async k=>k}},
   {provide:UsersService,useValue:{findByEmail:async email=>email===learner.email?learner:null,findById:async id=>id===learner._id?learner:null}},
   {provide:NotificationClient,useValue:new NotificationClient(config)},
  ],exports:[getConnectionToken(),ConfigService,I18nService,UsersService,NotificationClient]})(FixtureGlobals);
  const module=await Test.createTestingModule({imports:[FixtureGlobals,AdminsModule,PassportModule.register({defaultStrategy:'jwt'}),JwtModule.register({})],controllers:[AdminAuthController,AuthController],providers:[AuthService,JwtStrategy,LocalStrategy,{provide:APP_GUARD,useClass:JwtAuthGuard},{provide:APP_GUARD,useClass:PermissionsGuard}]}).compile();
  app=module.createNestApplication({logger:false});app.use(req('cookie-parser')());app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');
  configValues.IDENTITY_INTERNAL_URL=await app.getUrl();
  const http=request(app.getHttpServer()),jwt=app.get(JwtService);
  const {AdminActivationEmailWorker}=src('modules/gmail/admin-activation-email.worker.ts');
  const worker=new AdminActivationEmailWorker(createConnection(notificationPool),{get:key=>key==='ADMIN_ACTIVATION_EMAIL_WORKER_ENABLED'?'true':config.get(key)});
  const pipeline=mode=>{const {spawnSync}=require('node:child_process');const result=spawnSync('python',['tests/admin-iam-delivery-pipeline.py',mode],{encoding:'utf8',env:{...process.env,PYTHONPATH:process.env.ADMIN_IAM_PYTHONPATH,PGDATABASE:'identity_db'}});return {status:result.status,output:result.stdout,errors:result.stderr};};
  const epoch=async id=>(await pool.query('SELECT auth_version FROM public.admins WHERE id=$1',[id])).rows[0].auth_version;
  const claims=async id=>({_id:id,role:'ADMIN',auth_version:await epoch(id)});
  const token=async(id=ids.super,extra={})=>jwt.signAsync({...await claims(id),...extra},{secret:configValues.JWT_ACCESS_SECRET,expiresIn:'10m'});
  const api=async(method,url,body,id=ids.super)=>http[method](url).set('Authorization','Bearer '+await token(id)).send(body);
  const create=async name=>{
    const result=await api('post','/api/admin/admins',{email:name+'@example.test',username:name});assert.equal(result.status,201,JSON.stringify(result.body));return result.body.admin.id;
  };
  const tokenId=async id=>(await pool.query('SELECT id FROM public.admin_activation_tokens WHERE admin_id=$1 AND used_at IS NULL AND revoked_at IS NULL',[id])).rows[0].id;
  const rawFromMail=email=>{
    const mail=sent.filter(m=>m.to===email).at(-1);assert(mail,'Expected sandbox email');
    const href=/href="([^"]+)"/.exec(mail.html)[1].replaceAll('&amp;','&');return new URLSearchParams(new URL(href).hash.slice(1)).get('token');
  };
  const drain=()=>{const result=pipeline('drain');assert.equal(result.status,0,result.errors+result.output);};
  const sendAll=async()=>{for(let i=0;i<30&&await worker.runOnce();i++);};
  const delivered=async name=>{const id=await create(name);drain();await sendAll();return {id,token:rawFromMail(name+'@example.test'),tokenId:await tokenId(id)};};
  // Use one SQL statement timestamp so the exact-TTL CHECK remains true.
  const age=async(id,seconds)=>pool.query("UPDATE public.admin_activation_tokens SET created_at=created_at-make_interval(secs=>$2),expires_at=expires_at-make_interval(secs=>$2) WHERE admin_id=$1",[id,seconds]);
  const password='New-Admin-Password123!';
  let first,raw;
  await t.test('producer disabled/consumer gate missing cannot emit activation delivery events',async()=>{
    configValues.ADMIN_ACTIVATION_CONSUMER_READY='false';
    assert.equal((await api('post','/api/admin/admins',{email:'gate@example.test',username:'gate'})).status,503);
    assert.equal(Number((await pool.query("SELECT count(*) FROM public.admins WHERE email='gate@example.test'")).rows[0].count),0);
    configValues.ADMIN_ACTIVATION_CONSUMER_READY='true';
  });
  await t.test('pending issuance is transactional and hash-only, broker downtime leaves outbox unpublished',async()=>{
    first=await create('first');
    await http.post('/api/admin/auth/login').send({username:'first',password}).expect(401);
    const events=(await pool.query("SELECT * FROM public.outbox_events WHERE event_type='identity.admin.activation_email_requested.v1' AND aggregate_id=$1",[first])).rows;assert.equal(events.length,1);
    assert.deepEqual(Object.keys(events[0].payload).sort(),['adminId','expiresAt','tokenId']);
    assert.equal(pipeline('fail').status,2);
    assert.equal((await pool.query('SELECT published_at FROM public.outbox_events WHERE event_id=$1',[events[0].event_id])).rows[0].published_at,null);
  });
  await t.test('consumer failure rolls back inbox and job; redelivery and duplicate logical event create one job',async()=>{
    await notificationPool.query("ALTER TABLE public.notification_email_jobs ADD CONSTRAINT test_consumer_fault CHECK(subject<>'ADMIN_ACTIVATION_V1') NOT VALID");
    assert.equal(pipeline('drain').status,2);
    const event=(await pool.query("SELECT event_id FROM public.outbox_events WHERE aggregate_id=$1 AND event_type='identity.admin.activation_email_requested.v1'",[first])).rows[0].event_id;
    assert.equal(Number((await notificationPool.query('SELECT count(*) FROM public.inbox_events WHERE event_id=$1',[event])).rows[0].count),0);
    await notificationPool.query('ALTER TABLE public.notification_email_jobs DROP CONSTRAINT test_consumer_fault');drain();drain();
    assert.equal(Number((await notificationPool.query('SELECT count(*) FROM public.notification_email_jobs')).rows[0].count),1);
  });
  await t.test('leased sender dispatches via real Identity and Notification HTTP; only fake SMTP sees bearer link',async()=>{
    await sendAll();raw=rawFromMail('first@example.test');assert(raw);
    const mail=sent.at(-1);assert.equal(mail.subject,'[English Learning Platform] Kích hoạt tài khoản quản trị viên');assert(mail.html.includes('60 phút'));assert(mail.html.includes('https://admin.example.test/activate#'));
    const hash=require('node:crypto').createHash('sha256').update(raw).digest('hex');
    assert.equal((await pool.query('SELECT token_hash FROM public.admin_activation_tokens WHERE admin_id=$1',[first])).rows[0].token_hash,hash);
    const outbox=(await pool.query('SELECT payload FROM public.outbox_events')).rows;assert(!JSON.stringify(outbox).includes(raw));
    const job=(await notificationPool.query('SELECT * FROM public.notification_email_jobs')).rows[0];assert.equal(job.state,'completed');assert.equal(job.html,'{}');assert(!JSON.stringify(job).includes(raw));
  });
  await t.test('public status reveals no email; password validation, activation and first real admin login',async()=>{
    const status=await http.post('/api/admin/activation/status').send({token:raw}).expect(201);assert.equal(status.body.valid,true);assert(!JSON.stringify(status.body).includes('first@example.test'));
    await http.post('/api/admin/activation/activate').send({token:raw,password:'short',confirmPassword:'short'}).expect(400);
    const before=await epoch(first);
    const result=await http.post('/api/admin/activation/activate').send({token:raw,password,confirmPassword:password}).expect(201);assert.equal(result.body.activated,true);assert.equal(result.body.loginUrl,'https://admin.example.test/login');assert.equal(result.body.accessToken,undefined);assert.equal(await epoch(first),before+1);
    const account=(await pool.query('SELECT password_hash,status,activated_at FROM public.admins WHERE id=$1',[first])).rows[0];assert.equal(account.status,'ACTIVE');assert(account.activated_at);assert(await bcrypt.compare(password,account.password_hash));
    await http.post('/api/admin/auth/login').send({username:'first',password}).expect(201);
    await http.post('/api/admin/activation/activate').send({token:raw,password,confirmPassword:password}).expect(400);
    await api('post','/api/admin/admins/'+first+'/reinvite',{}).then(r=>assert.equal(r.status,400));
  });
  await t.test('exact expiry predicate and expired HTTP activation are rejected',async()=>{
    const invite=await delivered('expiry');
    const boundary=(await pool.query("SELECT expires_at<expires_at AS exact,expires_at-interval '1 microsecond'<expires_at AS before,expires_at+interval '1 microsecond'<expires_at AS after FROM public.admin_activation_tokens WHERE id=$1",[invite.tokenId])).rows[0];assert.deepEqual(boundary,{exact:false,before:true,after:false});
    await age(invite.id,3600);
    await http.post('/api/admin/activation/status').send({token:invite.token}).expect(400);
    await http.post('/api/admin/activation/activate').send({token:invite.token,password,confirmPassword:password}).expect(400);
  });
  await t.test('two concurrent activation requests only one commits',async()=>{
    const invite=await delivered('concurrent');
    const results=await Promise.all([1,2].map(()=>http.post('/api/admin/activation/activate').send({token:invite.token,password,confirmPassword:password})));
    assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);assert.equal(await epoch(invite.id),2);
  });
  await t.test('reinvite rate limit, old link revocation, locked account and ACTIVE reset prohibition',async()=>{
    const invite=await delivered('reinvite');
    assert.equal((await api('post','/api/admin/admins/'+invite.id+'/reinvite',{})).status,429);
    await age(invite.id,61);
    assert.equal((await api('post','/api/admin/admins/'+invite.id+'/reinvite',{})).status,201);
    await http.post('/api/admin/activation/status').send({token:invite.token}).expect(400);
    await http.post('/api/admin/activation/activate').send({token:invite.token,password,confirmPassword:password}).expect(400);drain();await sendAll();
    const newer=rawFromMail('reinvite@example.test');assert.notEqual(newer,invite.token);
    assert.equal((await api('patch','/api/admin/admins/'+invite.id+'/status',{status:'SUSPENDED'})).status,200);
    await http.post('/api/admin/activation/activate').send({token:newer,password,confirmPassword:password}).expect(400);
    assert.equal((await api('post','/api/admin/admins/'+invite.id+'/reinvite',{})).status,400);
    assert.equal((await api('patch','/api/admin/admins/'+invite.id+'/status',{status:'DISABLED'})).status,200);
    await http.post('/api/admin/activation/activate').send({token:newer,password,confirmPassword:password}).expect(400);
    assert.equal((await api('post','/api/admin/admins/'+ids.editor+'/reinvite',{},ids.editor)).status,403);
  });
  await t.test('legacy Phase 3 invitation is replaced with a fresh deliverable token',async()=>{
    configValues.ADMIN_ACTIVATION_DELIVERY_ENABLED='false';const id=await create('legacy');configValues.ADMIN_ACTIVATION_DELIVERY_ENABLED='true';const old=await tokenId(id);await age(id,61);
    assert.equal((await api('post','/api/admin/admins/'+id+'/reinvite',{})).status,201);assert.notEqual(await tokenId(id),old);
    assert((await pool.query('SELECT revoked_at FROM public.admin_activation_tokens WHERE id=$1',[old])).rows[0].revoked_at);drain();await sendAll();assert(rawFromMail('legacy@example.test'));
  });
  await t.test('expired and revoked invitations are cancelled before fake SMTP',async()=>{
    const expired=await create('unsentexpired'),revoked=await create('unsentrevoked');await age(expired,3601);
    await api('patch','/api/admin/admins/'+revoked+'/status',{status:'DISABLED'}).then(r=>assert.equal(r.status,200));
    const before=sent.length;drain();await sendAll();assert.equal(sent.length,before);
    assert.equal(Number((await notificationPool.query("SELECT count(*) FROM public.notification_email_jobs WHERE state='dead' AND last_error='INVITATION_UNAVAILABLE'")).rows[0].count),2);
  });
  await t.test('SMTP downtime backs off without losing invitation; retries succeed and crash lease is recovered',async()=>{
    const id=await create('smtpdown');drain();smtpDown=true;await worker.runOnce();
    let job=(await notificationPool.query('SELECT * FROM public.notification_email_jobs WHERE id=$1',[await tokenId(id)])).rows[0];assert.equal(job.state,'pending');assert.equal(job.attempts,1);assert.equal(job.last_error,'DELIVERY_UNAVAILABLE');assert(new Date(job.next_attempt_at)>new Date());
    smtpDown=false;await notificationPool.query("UPDATE public.notification_email_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",[job.id]);await worker.runOnce();assert(rawFromMail('smtpdown@example.test'));
    const crash=await create('crash');drain();await notificationPool.query("UPDATE public.notification_email_jobs SET state='active',lease_owner=$2,lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[await tokenId(crash),require('node:crypto').randomUUID()]);await worker.runOnce();assert(rawFromMail('crash@example.test'));
  });
  await t.test('pending profile email changes share issuance rate limit; old recipient cannot receive new link',async()=>{
    const id=await create('profilechange');
    assert.equal((await api('patch','/api/admin/admins/'+id,{email:'changed@example.test'})).status,429);
    assert.equal((await pool.query('SELECT email FROM public.admins WHERE id=$1',[id])).rows[0].email,'profilechange@example.test');
    await age(id,61);
    assert.equal((await api('patch','/api/admin/admins/'+id,{email:'changed@example.test'})).status,200);
    drain();await sendAll();assert(rawFromMail('changed@example.test'));assert.equal(sent.filter(m=>m.to==='profilechange@example.test').length,0);
  });
  await t.test('two senders claim separate jobs without duplicate concurrent dispatch',async()=>{
    await create('workerone');await create('workertwo');drain();
    const other=new AdminActivationEmailWorker(createConnection(notificationPool),{get:key=>key==='ADMIN_ACTIVATION_EMAIL_WORKER_ENABLED'?'true':config.get(key)});
    const count=sent.length;await Promise.all([worker.runOnce(),other.runOnce()]);assert.equal(sent.length,count+2);
    assert.equal(sent.filter(m=>m.to==='workerone@example.test').length,1);assert.equal(sent.filter(m=>m.to==='workertwo@example.test').length,1);
  });
  await t.test('retry exhaustion is terminal, descriptor scrubbed, and identity outage never permits bypass',async()=>{
    const id=await create('dead');drain();smtpDown=true;const tid=await tokenId(id);
    await notificationPool.query('UPDATE public.notification_email_jobs SET attempts=5 WHERE id=$1',[tid]);await worker.runOnce();smtpDown=false;
    const job=(await notificationPool.query('SELECT state,html,last_error FROM public.notification_email_jobs WHERE id=$1',[tid])).rows[0];assert.deepEqual(job,{state:'dead',html:'{}',last_error:'RETRY_EXHAUSTED'});
    const unavailable=await create('identitydown');drain();const url=configValues.IDENTITY_INTERNAL_URL;configValues.IDENTITY_INTERNAL_URL='http://127.0.0.1:1';await worker.runOnce();configValues.IDENTITY_INTERNAL_URL=url;
    assert.equal((await notificationPool.query('SELECT state FROM public.notification_email_jobs WHERE id=$1',[await tokenId(unavailable)])).rows[0].state,'pending');
  });
  await t.test('audit failure rolls back password/state/token consumption; retry can activate',async()=>{
    const invite=await delivered('auditrollback');await pool.query("ALTER TABLE public.outbox_events ADD CONSTRAINT activation_audit_fault CHECK(event_type<>'identity.admin.authorization_changed.v1') NOT VALID");
    await http.post('/api/admin/activation/activate').send({token:invite.token,password,confirmPassword:password}).expect(500);
    await pool.query('ALTER TABLE public.outbox_events DROP CONSTRAINT activation_audit_fault');
    const account=(await pool.query('SELECT status,password_hash FROM public.admins WHERE id=$1',[invite.id])).rows[0];assert.equal(account.status,'PENDING_ACTIVATION');assert.equal(account.password_hash,null);assert.equal((await pool.query('SELECT used_at FROM public.admin_activation_tokens WHERE id=$1',[invite.tokenId])).rows[0].used_at,null);
    await http.post('/api/admin/activation/activate').send({token:invite.token,password,confirmPassword:password}).expect(201);
  });
  await t.test('public input/brute-force protection and internal dispatch authentication',async()=>{
    await http.post('/api/_internal/identity/admin-activation/deliver').send({tokenId:await tokenId(ids.editor).catch(()=>ids.editor)}).expect(403);
    await http.post('/api/admin/activation/status').send({email:'first@example.test'}).expect(400);
    const responses=[];for(let i=0;i<22;i++)responses.push((await http.post('/api/admin/activation/status').send({token:'invalid'})).status);assert(responses.includes(429));
  });
  await t.test('learner login/refresh remain unchanged without ADMIN epoch',async()=>{
    const login=await http.post('/api/auth/login').send({email:learner.email,password:'phase3-fixture-password'}).expect(201);assert.equal((await jwt.verifyAsync(login.body.accessToken,{secret:configValues.JWT_ACCESS_SECRET})).role,'USER');
    const refresh=await jwt.signAsync({_id:learner._id,email:learner.email,role:'USER'},{secret:configValues.JWT_REFRESH_SECRET});await http.post('/api/auth/refresh-token').set('Cookie','user_refresh_token='+refresh).send({}).expect(201);
  });

 } finally {if(app)await app.close();if(notificationApp)await notificationApp.close();await pool.end();await notificationPool.end();if(originalInternalToken===undefined)delete process.env.INTERNAL_SERVICE_TOKEN;else process.env.INTERNAL_SERVICE_TOKEN=originalInternalToken;}
});
