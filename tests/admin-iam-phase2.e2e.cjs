/** HTTP + real PostgreSQL authorization tests. Only marked disposable test cluster. */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module'),req=createRequire(path.resolve('apps/api/package.json'));
req('reflect-metadata');
const {Pool}=req('pg'),bcrypt=req('bcrypt'),request=req('supertest');
const {Test}=req('@nestjs/testing'),{APP_GUARD}=req('@nestjs/core');
const {Get,Global,Module}=req('@nestjs/common'),{PassportModule}=req('@nestjs/passport'),{JwtModule,JwtService}=req('@nestjs/jwt');
const {ConfigService}=req('@nestjs/config'),{I18nService}=req('nestjs-i18n'),{of,firstValueFrom,toArray}=req('rxjs');
const load=require('./helpers/load-typescript.cjs'),{controllers,routes}=require('./admin-iam-policy-coverage.cjs');
const src=f=>load('apps/api/src/'+f);
const {createConnection,getConnectionToken}=src('postgres/connection.ts');
const {AdminsService}=src('modules/admins/admins.service.ts'),{AdminRbacService}=src('modules/admins/admin-rbac.service.ts'),{RbacRepository}=src('modules/admins/rbac.repository.ts');
const {AdminAuthorizationService}=src('modules/admins/admin-authorization.service.ts');
const {IdentityIntrospectionController}=src('modules/auth/identity-introspection.controller.ts');
const {AuthService}=src('modules/auth/auth.service.ts'),{JwtStrategy}=src('modules/auth/strategy/jwt.strategy.ts'),{LocalStrategy}=src('modules/auth/strategy/local.strategy.ts');
const {JwtAuthGuard}=src('modules/auth/guards/jwt-auth.guard.ts'),{PermissionsGuard}=src('modules/auth/guards/permissions.guard.ts');
const {IdentityTokenVerifier,ServiceJwtModule}=src('modules/auth/service-jwt.module.ts');
const {UsersService}=src('modules/users/users.service.ts'),{NotificationClient}=src('common/clients/notification-client.ts');
const {AdminController}=src('modules/auth/decorators/admin-controller.decorator.ts');
const {RequirePermissions}=src('modules/auth/decorators/require-permissions.decorator.ts');
const cookieParser=req('cookie-parser');
const ids={super:'11111111-1111-4111-8111-111111111111',editor:'22222222-2222-4222-8222-222222222222',second:'33333333-3333-4333-8333-333333333333',empty:'44444444-4444-4444-8444-444444444444',pending:'55555555-5555-4555-8555-555555555555',user:'66666666-6666-4666-8666-666666666666'};
class UnknownController {unmapped(){return {unexpected:true};}}
AdminController('iam-e2e-unmapped')(UnknownController);Get()(UnknownController.prototype,'unmapped',Object.getOwnPropertyDescriptor(UnknownController.prototype,'unmapped'));
class RemoteProbe {read(){return {ok:true};}}
AdminController('iam-e2e-remote')(RemoteProbe);Get()(RemoteProbe.prototype,'read',Object.getOwnPropertyDescriptor(RemoteProbe.prototype,'read'));RequirePermissions('users.read')(RemoteProbe.prototype,'read',Object.getOwnPropertyDescriptor(RemoteProbe.prototype,'read'));
const status=n=>error=>error.getStatus?.()===n;

test('Phase 2 backend HTTP E2E and PostgreSQL revocation',async t=>{
 const port=Number(process.env.ADMIN_IAM_TEST_PORT);assert(Number.isInteger(port)&&port>1024&&port!==5432);
 assert(process.env.ADMIN_IAM_TEST_PASSWORD,'Explicit test password required');
 const pool=new Pool({host:'127.0.0.1',port,user:'vl_identity',password:process.env.ADMIN_IAM_TEST_PASSWORD,database:'identity_db'});
 let app,remote;
 try{
  assert.equal((await pool.query('SHOW cluster_name')).rows[0].cluster_name,'admin-iam-phase1-test');
  await pool.query('DROP SCHEMA public CASCADE');await pool.query('CREATE SCHEMA public AUTHORIZATION vl_identity');
  const {migrate}=await import('../apps/api/src/postgres/migrations.ts');await migrate(pool,'identity');
  const digest=await bcrypt.hash('fixture-password-for-iam',4);
  for(const name of ['super','editor','second','empty'])await pool.query(`INSERT INTO public.admins(id,email,username,password_hash,status) VALUES($1,$2,$3,$4,'ACTIVE')`,[ids[name],name+'@example.test',name,digest]);
  await pool.query(`INSERT INTO public.admins(id,email,username) VALUES($1,'pending@example.test','pending')`,[ids.pending]);
  await pool.query(`INSERT INTO public.admin_roles(admin_id,role_id) SELECT $1::uuid,id FROM public.roles WHERE code='SUPER_ADMIN'`,[ids.super]);
  const role=(await pool.query(`INSERT INTO public.roles(code,name) VALUES('E2E_EDITOR','Editor') RETURNING id`)).rows[0].id;
  await pool.query(`INSERT INTO public.role_permissions(role_id,permission_id) SELECT $1::uuid,id FROM public.permissions WHERE code IN ('users.read','vocabulary.read','audio.jobs.read')`,[role]);
  await pool.query(`INSERT INTO public.admin_roles(admin_id,role_id) VALUES($1,$3),($2,$3)`,[ids.editor,ids.second,role]);
  await pool.query('INSERT INTO public.admin_roles(admin_id,role_id) VALUES($1,$2)',[ids.pending,role]);
  const values={JWT_ACCESS_SECRET:'iam-e2e-access-secret',JWT_REFRESH_SECRET:'iam-e2e-refresh-secret',JWT_ACCESS_TOKEN_EXPIRES:'10m',JWT_REFRESH_TOKEN_EXPIRES:'1d',IDENTITY_INTERNAL_TOKEN:'iam-e2e-internal-secret-over-24-chars',COOKIE_SECURE:'false',COOKIE_SAME_SITE:'lax'};
  const config={get:key=>values[key],getOrThrow:key=>{if(!values[key])throw Error('Missing '+key);return values[key];}};
  const user={_id:ids.user,id:ids.user,email:'learner@example.test',username:'learner',password:digest,authProvider:'local',isVerified:true,isDeleted:false};
  let provisioned,rawCreateCalls=0;
  const users={findByEmail:async email=>email===user.email?user:null,findById:async id=>id===user._id?user:null,
   findAllAdmin:async()=>({items:[]}),create:async()=>{rawCreateCalls++;throw Error('Unsafe legacy create called');},createAdmin:async dto=>{provisioned=dto;return {ok:true};},updateProfile:async()=>({ok:true})};
  const providerMap=new Map([[getConnectionToken(),createConnection(pool)],[ConfigService,config],[I18nService,{t:async k=>k,translate:async k=>k}],[UsersService,users],[NotificationClient,{log:async()=>{},sendEmail:async()=>{},reportError:()=>{}}]]);
  const actual=new Set([AdminsService,AdminRbacService,RbacRepository,AuthService,JwtStrategy,LocalStrategy,IdentityTokenVerifier,JwtService,...providerMap.keys()]);
  // All production controllers participate; only unrelated business services are test doubles.
  const businessTokens=new Set();
  for(const cls of controllers){const types=Reflect.getMetadata('design:paramtypes',cls)||[];for(const explicit of Reflect.getMetadata('self:paramtypes',cls)||[])types[explicit.index]=explicit.param;for(const token of types)if(token&&!actual.has(token))businessTokens.add(token);}
  const mocks=[...businessTokens].map(provide=>({provide,useValue:new Proxy({}, {get:(_t,key)=>{
   if(key==='then')return undefined;
   if(key==='status')return async()=>({state:'active'});
   if(provide.name==='TtsService' && ['synthesize','synthesizeSequence'].includes(key))return async()=>({contentType:'audio/wav',audio:Buffer.from('fixture-audio')});
   if(key==='remove' && provide.name==='ExamCommunityService')return async(_exam,_id,actor,moderator)=>{if(actor!==ids.user&&!moderator){const {ForbiddenException}=req('@nestjs/common');throw new ForbiddenException();}return {deleted:true};};
   return async()=>({ok:true});
  }})}));
  const module=await Test.createTestingModule({imports:[PassportModule.register({defaultStrategy:'jwt'}),JwtModule.register({})],controllers:[...controllers,IdentityIntrospectionController,UnknownController],providers:[...mocks,...[...providerMap].map(([provide,useValue])=>({provide,useValue})),AdminsService,AdminRbacService,RbacRepository,AuthService,JwtStrategy,LocalStrategy,IdentityTokenVerifier,{provide:APP_GUARD,useClass:JwtAuthGuard},{provide:APP_GUARD,useClass:PermissionsGuard}]}).compile();
  app=module.createNestApplication({logger:false});app.use(cookieParser());app.setGlobalPrefix('api');
  // Probe mode short-circuits business execution AFTER real guards, preserving real controller metadata/routes.
  app.useGlobalInterceptors({intercept:(context,next)=>{
   if(context.switchToHttp().getRequest().headers['x-iam-policy-probe']!=='1')return next.handle();
   if(context.getClass().name==='TtsController' && ['synthesize','synthesizeSequence'].includes(context.getHandler().name)){context.switchToHttp().getResponse().json({ok:true});return of(undefined);}
   return of({ok:true});
  }});
  await app.listen(0,'127.0.0.1');const base=await app.getUrl();values.IDENTITY_INTROSPECTION_URL=base+'/api/_internal/identity/introspect';
  const jwt=app.get(JwtService),admins=app.get(AdminsService),rbac=app.get(AdminRbacService),mutations=new AdminAuthorizationService(createConnection(pool));
  const epoch=async name=>(await pool.query('SELECT auth_version FROM public.admins WHERE id=$1',[ids[name]])).rows[0].auth_version;
  const claims=async name=>({_id:ids[name],email:name+'@example.test',role:'ADMIN',auth_version:await epoch(name)});
  const token=async(name,extra={})=>jwt.signAsync({...await claims(name),...extra},{secret:values.JWT_ACCESS_SECRET,expiresIn:'10m'});
  const refreshToken=async(name,extra={})=>jwt.signAsync({...await claims(name),...extra},{secret:values.JWT_REFRESH_SECRET,expiresIn:'1d'});
  const learner=await jwt.signAsync({_id:ids.user,email:user.email,role:'USER'},{secret:values.JWT_ACCESS_SECRET,expiresIn:'10m'});
  const http=request(app.getHttpServer());
  console.log('Identity E2E host ready; executing real HTTP policy matrix');
  await t.test('all 235 production route policies pass HTTP guards for their documented audience',async()=>{
   const superToken=await token('super'),emptyToken=await token('empty');let allowed=0,denied=0;
   for(const row of routes){const url=row.url.replace(/:[A-Za-z0-9_]+/g,ids.editor);const verb=row.method.toLowerCase();
    const audience=row.exemption==='E5'?learner:superToken;
    const res=await http[verb](url).set('Authorization','Bearer '+audience).set('x-iam-policy-probe','1').send({}).timeout({response:6000,deadline:8000});
    assert(res.status>=200&&res.status<300,row.method+' '+row.url+' -> '+res.status+' '+JSON.stringify(res.body));allowed++;
    if(row.permissions.length&&row.condition!=='C3'){
     const reject=await http[verb](url).set('Authorization','Bearer '+emptyToken).set('x-iam-policy-probe','1').send({permissions:['*']});
     assert.equal(reject.status,403,row.method+' '+row.url);denied++;
    }
   }
   assert.equal(allowed,235);console.log('HTTP MATRIX:',allowed,'allowed policies;',denied,'missing-permission denials');
  });
  await t.test('real login, legacy/stale tokens, unauthenticated and USER boundaries',async()=>{
   const login=await http.post('/api/admin/auth/login').send({username:'editor',password:'fixture-password-for-iam'}).expect(201);
   const access=await jwt.verifyAsync(login.body.accessToken,{secret:values.JWT_ACCESS_SECRET});const refresh=await jwt.verifyAsync(login.body.refreshToken,{secret:values.JWT_REFRESH_SECRET});
   assert.equal(access.role,'ADMIN');assert.equal(access.auth_version,1);assert.equal(refresh.auth_version,1);
   await http.get('/api/admin/users').set('Authorization','Bearer '+login.body.accessToken).expect(200);
   await http.get('/api/admin/users').expect(401);
   await http.get('/api/admin/users').set('Authorization','Bearer '+learner).expect(403);
   const legacy=await jwt.signAsync({_id:ids.editor,email:'editor@example.test',role:'ADMIN'},{secret:values.JWT_ACCESS_SECRET,expiresIn:'10m'});
   await http.get('/api/admin/users').set('Authorization','Bearer '+legacy).expect(401);
   await http.get('/api/admin/users').set('Authorization','Bearer '+await token('empty',{permissions:['users.read'],isSuperAdmin:true})).expect(403);
   await http.get('/api/admin/users').set('Authorization','Bearer '+await token('editor',{role:'SUPER_ADMIN'})).expect(401);
   await http.get('/api/admin/users').set('Authorization','Bearer '+await token('editor',{auth_version:99})).expect(401);
   await http.post('/api/admin/auth/refresh-token').send({refreshToken:await refreshToken('editor',{auth_version:99})}).expect(401);
   const oldRefresh=await jwt.signAsync({_id:ids.editor,role:'ADMIN'},{secret:values.JWT_REFRESH_SECRET});
   await http.post('/api/admin/auth/refresh-token').send({refreshToken:oldRefresh}).expect(401);
   await http.get('/api/admin/iam-e2e-unmapped').set('Authorization','Bearer '+await token('super')).expect(403);
  });
  await t.test('learner auth remains usable; C2 provisioning, C3 moderation and C5 self-service cannot bypass IAM',async()=>{
   const login=await http.post('/api/auth/login').send({email:user.email,password:'fixture-password-for-iam'}).expect(201);
   const signed=await jwt.verifyAsync(login.body.accessToken,{secret:values.JWT_ACCESS_SECRET});assert.equal(signed.role,'USER');assert.equal(signed.auth_version,undefined);
   await http.patch('/api/users/profile').set('Authorization','Bearer '+learner).send({username:'learner'}).expect(200);
   await http.patch('/api/users/profile').set('Authorization','Bearer '+await token('super')).send({username:'admin'}).expect(403);
   await http.post('/api/auth/change-password').set('Authorization','Bearer '+await token('super')).send({}).expect(403);
   await http.post('/api/users').set('Authorization','Bearer '+learner).send({}).expect(403);
   await http.post('/api/users').set('Authorization','Bearer '+await token('empty')).send({}).expect(403);
   await http.post('/api/users').set('Authorization','Bearer '+await token('super')).send({email:'legacy@example.test',username:'legacy',password:'fixture-new-learner'}).expect(201);
   assert.equal(rawCreateCalls,0);assert.equal(provisioned.name,'legacy');
   await http.post('/api/users').set('Authorization','Bearer '+await token('super')).send({authProvider:'google',code:'override'}).expect(400);
   const comment='/api/exams/'+ids.editor+'/comments/'+ids.second;
   await http.delete(comment).set('Authorization','Bearer '+learner).expect(200);
   await http.delete(comment).set('Authorization','Bearer '+await token('empty')).expect(403);
   await http.delete(comment).set('Authorization','Bearer '+await token('super')).expect(200);
   const borrowed=await refreshToken('editor');
   await http.post('/api/auth/refresh-token').set('Cookie','user_refresh_token='+borrowed).send({}).expect(401);
   const learnerRefresh=await jwt.signAsync({_id:user._id,email:user.email,role:'USER'},{secret:values.JWT_REFRESH_SECRET,expiresIn:'1d'});
   await http.post('/api/auth/refresh-token').set('Cookie','user_refresh_token='+learnerRefresh).send({}).expect(201);
   await http.post('/api/tts/synthesize').set('Authorization','Bearer '+learner).send({}).expect(200);
   await http.post('/api/tts/synthesize').set('Authorization','Bearer '+await token('empty')).send({}).expect(403);
  });
  await t.test('C1 and alias/factory requests enforce the exact permission intersection',async()=>{
   await mutations.setRolePermissions(await claims('super'),role,['users.read','users.create','users.update','vocabulary.read','audio.jobs.read']);
   const editor=await token('editor');
   await http.patch('/api/admin/users/'+ids.second).set('Authorization','Bearer '+editor).set('x-iam-policy-probe','1').send({status:'active'}).expect(403);
   await http.post('/api/admin/users').set('Authorization','Bearer '+editor).set('x-iam-policy-probe','1').send({status:'banned'}).expect(403);
   await http.patch('/api/admin/users/'+ids.second).set('Authorization','Bearer '+editor).set('x-iam-policy-probe','1').send({name:'ordinary edit'}).expect(200);
   for(const url of ['/api/collections','/api/lessons','/api/upload'])await http.post(url).set('Authorization','Bearer '+editor).send({}).expect(403);
   await http.get('/api/admin/words/'+ids.editor+'/publication').set('Authorization','Bearer '+editor).expect(403);
   await http.post('/api/admin/words/'+ids.editor+'/publish').set('Authorization','Bearer '+editor).expect(403);
   await http.get('/api/admin/words/'+ids.editor+'/publication').set('Authorization','Bearer '+await token('super')).expect(200);
  });
  await t.test('membership changes invalidate access and refresh without resurrecting old epochs',async()=>{
   const old=await token('editor'),oldRefresh=await refreshToken('editor'),before=await epoch('editor');
   await mutations.setAdminRoles(await claims('super'),ids.editor,[]);assert.equal(await epoch('editor'),before+1);
   await http.get('/api/admin/users').set('Authorization','Bearer '+old).expect(401);
   await http.post('/api/admin/auth/refresh-token').send({refreshToken:oldRefresh}).expect(401);
   await http.get('/api/admin/users').set('Authorization','Bearer '+await token('editor')).expect(403);
   await mutations.setAdminRoles(await claims('super'),ids.editor,[role]);
   await http.get('/api/admin/users').set('Authorization','Bearer '+old).expect(401);
   await http.get('/api/admin/users').set('Authorization','Bearer '+await token('editor')).expect(200);
  });
  await t.test('role permission edits revoke ALL affected admins; audit failure rolls back atomically',async()=>{
   const a=await token('editor'),b=await token('second'),va=await epoch('editor'),vb=await epoch('second'),vp=await epoch('pending');
   await mutations.setRolePermissions(await claims('super'),role,['vocabulary.read','audio.jobs.read']);
   assert.equal(await epoch('editor'),va+1);assert.equal(await epoch('second'),vb+1);assert.equal(await epoch('pending'),vp+1);
   await http.get('/api/admin/users').set('Authorization','Bearer '+a).expect(401);
   await http.get('/api/admin/users').set('Authorization','Bearer '+b).expect(401);
   await http.get('/api/admin/users').set('Authorization','Bearer '+await token('editor')).expect(403);
   const before=await epoch('editor');
   await pool.query(`ALTER TABLE public.outbox_events ADD CONSTRAINT fixture_block_authorization CHECK(event_type<>'identity.admin.authorization_changed.v1') NOT VALID`);
   try {await assert.rejects(mutations.setRolePermissions(await claims('super'),role,['users.read']));}finally{await pool.query('ALTER TABLE public.outbox_events DROP CONSTRAINT fixture_block_authorization');}
   assert.equal(await epoch('editor'),before);assert.deepEqual(await rbac.getEffectivePermissions(ids.editor),['audio.jobs.read','vocabulary.read']);
   await mutations.setRolePermissions(await claims('super'),role,['users.read','audio.jobs.read','vocabulary.read']);
   await assert.rejects(mutations.setAdminRoles(await claims('empty'),ids.editor,[]),status(403));
   const system=(await pool.query(`SELECT id FROM public.roles WHERE code='SUPER_ADMIN'`)).rows[0].id;
   await assert.rejects(mutations.setRolePermissions(await claims('super'),system,[]),status(403));
   await assert.rejects(mutations.setAdminRoles(await claims('super'),ids.empty,[system]),status(403));
   await assert.rejects(mutations.setRolePermissions(await claims('super'),role,['roles.manage']),status(403));
  });
  await t.test('SUSPENDED/DISABLED/pending deny access and refresh; unlock requires fresh login',async()=>{
   for(const state of ['SUSPENDED','DISABLED']){
    const old=await token('editor'),refresh=await refreshToken('editor');
    await mutations.setStatus(await claims('super'),ids.editor,state);
    await http.get('/api/admin/users').set('Authorization','Bearer '+old).expect(401);
    await http.get('/api/admin/users').set('Authorization','Bearer '+await token('editor')).expect(401);
    await http.post('/api/admin/auth/refresh-token').send({refreshToken:refresh}).expect(401);
    await http.post('/api/admin/auth/login').send({username:'editor',password:'fixture-password-for-iam'}).expect(401);
    await mutations.setStatus(await claims('super'),ids.editor,'ACTIVE');
    await http.get('/api/admin/users').set('Authorization','Bearer '+old).expect(401);
    await http.post('/api/admin/auth/refresh-token').send({refreshToken:refresh}).expect(401);
    await http.post('/api/admin/auth/login').send({username:'editor',password:'fixture-password-for-iam'}).expect(201);
   }
   await http.get('/api/admin/users').set('Authorization','Bearer '+await token('pending')).expect(401);
   await assert.rejects(mutations.setStatus(await claims('super'),ids.pending,'ACTIVE'),status(400));
   await assert.rejects(mutations.setStatus(await claims('super'),ids.super,'SUSPENDED'),status(403));
  });
  await t.test('logout revokes access/refresh and stale logout cannot revoke a later epoch',async()=>{
   const old=await token('editor'),refresh=await refreshToken('editor'),version=await epoch('editor');
   await http.post('/api/admin/auth/logout').set('Authorization','Bearer '+old).send({}).expect(201);
   assert.equal(await epoch('editor'),version+1);
   await http.get('/api/admin/users').set('Authorization','Bearer '+old).expect(401);
   await http.post('/api/admin/auth/refresh-token').send({refreshToken:refresh}).expect(401);
   await http.post('/api/admin/auth/logout').set('Authorization','Bearer '+old).send({}).expect(201);
   assert.equal(await epoch('editor'),version+1);
   await http.get('/api/admin/users').set('Authorization','Bearer '+await token('editor')).expect(200);
   const staleActor=await claims('super'),targetVersion=await epoch('second');
   await admins.revokeToken(staleActor);
   await assert.rejects(mutations.setAdminRoles(staleActor,ids.second,[]),status(401));
   assert.equal(await epoch('second'),targetVersion);
  });
  await t.test('business service uses current introspection; Identity outage never bypasses authorization',async()=>{
   class TestConfigModule {}Global()(TestConfigModule);Module({providers:[{provide:ConfigService,useValue:config}],exports:[ConfigService]})(TestConfigModule);
   const rm=await Test.createTestingModule({imports:[TestConfigModule,ServiceJwtModule],controllers:[RemoteProbe]}).compile();
   remote=rm.createNestApplication({logger:false});remote.setGlobalPrefix('api');await remote.listen(0,'127.0.0.1');const rh=request(remote.getHttpServer());
   let raw=await token('editor');await rh.get('/api/admin/iam-e2e-remote').set('Authorization','Bearer '+raw).expect(200);
   await mutations.setRolePermissions(await claims('super'),role,['audio.jobs.read']);
   await rh.get('/api/admin/iam-e2e-remote').set('Authorization','Bearer '+raw).expect(401);
   raw=await token('editor');await rh.get('/api/admin/iam-e2e-remote').set('Authorization','Bearer '+raw).set('x-permissions','["users.read"]').expect(403);
   const saved=values.IDENTITY_INTROSPECTION_URL;values.IDENTITY_INTROSPECTION_URL='http://127.0.0.1:1/not-identity';
   await rh.get('/api/admin/iam-e2e-remote').set('Authorization','Bearer '+raw).expect(503);values.IDENTITY_INTROSPECTION_URL=saved;
   await mutations.setRolePermissions(await claims('super'),role,['users.read','audio.jobs.read','vocabulary.read']);
  });
  await t.test('SSE stops streaming job data after role/version revocation',async()=>{
   const raw=await token('editor');const response=await fetch(base+'/api/admin/audio/jobs/'+ids.editor+'/events',{headers:{authorization:'Bearer '+raw}});assert.equal(response.status,200);
   const reader=response.body.getReader(),decode=new TextDecoder();let text='';
   try{
    while(!text.includes('data:')){const result=await reader.read();assert(!result.done);text+=decode.decode(result.value);}
    assert(text.includes('active'));
    await mutations.setRolePermissions(await claims('super'),role,['users.read']);
    let after='';await Promise.race([(async()=>{for(;;){const r=await reader.read();if(r.done)return;after+=decode.decode(r.value);}})(),new Promise((_,reject)=>setTimeout(()=>reject(Error('SSE did not stop after revoke')),4500))]);
    assert(!after.includes('"state":"active"'),'Revoked stream emitted more job data');
   }finally{await reader.cancel().catch(()=>{});}
  });
  await t.test('SSE rechecks JWT expiration after connection authentication',async()=>{
   await mutations.setRolePermissions(await claims('super'),role,['users.read','audio.jobs.read']);
   const raw=await jwt.signAsync(await claims('editor'),{secret:values.JWT_ACCESS_SECRET,expiresIn:1});
   const response=await fetch(base+'/api/admin/audio/jobs/'+ids.editor+'/events',{headers:{authorization:'Bearer '+raw}});assert.equal(response.status,200);
   const reader=response.body.getReader(),decode=new TextDecoder();let text='';
   try{
    while(!text.includes('data:')){const r=await reader.read();assert(!r.done);text+=decode.decode(r.value);}
    assert(text.includes('active'));
    let after='';await Promise.race([(async()=>{for(;;){const r=await reader.read();if(r.done)return;after+=decode.decode(r.value);}})(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Expired SSE did not stop')),4500))]);
    assert(!after.includes('"state":"active"'));
   }finally{await reader.cancel().catch(()=>{});}
  });
  await t.test('concurrent status changes cannot remove the last active Super Admin',async()=>{
   await pool.query(`INSERT INTO public.admin_roles(admin_id,role_id) SELECT $1::uuid,id FROM public.roles WHERE code='SUPER_ADMIN'`,[ids.empty]);
   const actor=await claims('super');const results=await Promise.allSettled([mutations.setStatus(actor,ids.super,'SUSPENDED'),mutations.setStatus(actor,ids.empty,'SUSPENDED')]);
   const active=(await pool.query(`SELECT a.id FROM public.admins a JOIN public.admin_roles ar ON ar.admin_id=a.id JOIN public.roles r ON r.id=ar.role_id WHERE r.code='SUPER_ADMIN' AND a.status='ACTIVE' AND NOT a.is_deleted`)).rows;
   assert.equal(active.length,1);assert(results.some(r=>r.status==='rejected'));
  });
 }finally{if(remote)await remote.close();if(app)await app.close();await pool.end();}
});
