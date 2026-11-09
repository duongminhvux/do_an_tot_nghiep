/** Phase 3 HTTP E2E uses production AdminsModule, guards and native SQL on a marked isolated PostgreSQL. */
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
const {AdminAuthorizationService}=src('modules/admins/admin-authorization.service.ts');
const {AdminManagementService}=src('modules/admins/admin-management.service.ts');
const {AdminAuthController}=src('modules/auth/admin-auth.controller.ts'),{AuthController}=src('modules/auth/auth.controller.ts');
const {AuthService}=src('modules/auth/auth.service.ts'),{JwtStrategy}=src('modules/auth/strategy/jwt.strategy.ts'),{LocalStrategy}=src('modules/auth/strategy/local.strategy.ts');
const {JwtAuthGuard}=src('modules/auth/guards/jwt-auth.guard.ts'),{PermissionsGuard}=src('modules/auth/guards/permissions.guard.ts');
const {UsersService}=src('modules/users/users.service.ts'),{NotificationClient}=src('common/clients/notification-client.ts');
const {iamRoutes}=require('./admin-iam-policy-coverage.cjs');
const ids={super:'11111111-1111-4111-8111-111111111111',editor:'22222222-2222-4222-8222-222222222222',second:'33333333-3333-4333-8333-333333333333',user:'66666666-6666-4666-8666-666666666666'};

test('Phase 3 native PostgreSQL and real IAM HTTP API',async t=>{
 const port=Number(process.env.ADMIN_IAM_TEST_PORT);
 assert(Number.isInteger(port)&&port>1024&&port!==5432);assert(process.env.ADMIN_IAM_TEST_PASSWORD);
 const pool=new Pool({host:'127.0.0.1',port,user:'vl_identity',password:process.env.ADMIN_IAM_TEST_PASSWORD,database:'identity_db'});
 let app;
 try {
  assert.equal((await pool.query('SHOW cluster_name')).rows[0].cluster_name,'admin-iam-phase1-test');
  await pool.query('DROP SCHEMA public CASCADE');await pool.query('CREATE SCHEMA public AUTHORIZATION vl_identity');
  const {migrate}=await import('../apps/api/src/postgres/migrations.ts');await migrate(pool,'identity');
  const digest=await bcrypt.hash('phase3-fixture-password',4);
  for(const name of ['super','editor','second'])await pool.query(`INSERT INTO public.admins(id,email,username,password_hash,status) VALUES($1,$2,$3,$4,'ACTIVE')`,[ids[name],name+'@example.test',name,digest]);
  const superRole=(await pool.query("SELECT id FROM public.roles WHERE code='SUPER_ADMIN'")).rows[0].id;
  await pool.query('INSERT INTO public.admin_roles(admin_id,role_id) VALUES($1,$2)',[ids.super,superRole]);
  const ordinary=(await pool.query("INSERT INTO public.roles(code,name) VALUES('ORDINARY','Ordinary') RETURNING id")).rows[0].id;
  await pool.query('INSERT INTO public.admin_roles(admin_id,role_id) VALUES($1,$2)',[ids.editor,ordinary]);
  const configValues={JWT_ACCESS_SECRET:'phase3-access-secret',JWT_REFRESH_SECRET:'phase3-refresh-secret',JWT_ACCESS_TOKEN_EXPIRES:'10m',JWT_REFRESH_TOKEN_EXPIRES:'1d',COOKIE_SECURE:'false'};
  const config={get:key=>configValues[key],getOrThrow:key=>configValues[key]};
  const learner={_id:ids.user,id:ids.user,email:'learner@example.test',username:'learner',password:digest,authProvider:'local',isVerified:true,isDeleted:false};
  class FixtureGlobals {}
  Global()(FixtureGlobals);Module({providers:[
   {provide:getConnectionToken(),useValue:createConnection(pool)},
   {provide:ConfigService,useValue:config},{provide:I18nService,useValue:{t:async k=>k,translate:async k=>k}},
   {provide:UsersService,useValue:{findByEmail:async email=>email===learner.email?learner:null,findById:async id=>id===learner._id?learner:null}},
   {provide:NotificationClient,useValue:{log:async()=>{},sendEmail:async()=>{},reportError:()=>{}}},
  ],exports:[getConnectionToken(),ConfigService,I18nService,UsersService,NotificationClient]})(FixtureGlobals);
  const module=await Test.createTestingModule({imports:[FixtureGlobals,AdminsModule,PassportModule.register({defaultStrategy:'jwt'}),JwtModule.register({})],controllers:[AdminAuthController,AuthController],providers:[AuthService,JwtStrategy,LocalStrategy,{provide:APP_GUARD,useClass:JwtAuthGuard},{provide:APP_GUARD,useClass:PermissionsGuard}]}).compile();
  app=module.createNestApplication({logger:false});app.use(req('cookie-parser')());app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');
  const http=request(app.getHttpServer()),jwt=app.get(JwtService);
  const epoch=async id=>(await pool.query('SELECT auth_version FROM public.admins WHERE id=$1',[id])).rows[0].auth_version;
  const claims=async id=>({_id:id,role:'ADMIN',auth_version:await epoch(id)});
  const token=async(id=ids.super,extra={})=>jwt.signAsync({...await claims(id),...extra},{secret:configValues.JWT_ACCESS_SECRET,expiresIn:'10m'});
  const api=async(method,url,body,id=ids.super)=>http[method](url).set('Authorization','Bearer '+await token(id)).send(body);
  let role,pending;
  await t.test('all 12 API have permission policies, reject unauthenticated/USER/ordinary ADMIN',async()=>{
   assert.equal(iamRoutes.length,12);
   const userToken=await jwt.signAsync({_id:ids.user,email:learner.email,role:'USER'},{secret:configValues.JWT_ACCESS_SECRET});
   for(const row of iamRoutes){const url=row.url.replace(':id',ids.editor),method=row.method.toLowerCase();
    await http[method](url).send({}).expect(401);
    await http[method](url).set('Authorization','Bearer '+userToken).send({}).expect(403);
    assert.equal((await api(method,url,{},ids.editor)).status,403,url);
   }
  });
  await t.test('ordinary ADMIN with IAM permissions still cannot use any IAM API',async()=>{
   // Deliberately corrupt the fixture grant to exercise the independent Super Admin check.
   await pool.query(`INSERT INTO public.role_permissions(role_id,permission_id) SELECT $1,id FROM public.permissions WHERE resource IN ('admins','roles')`,[ordinary]);
   for(const row of iamRoutes){const method=row.method.toLowerCase(),url=row.url.replace(':id',ids.editor);
    const bodies={create:row.controller.name==='AdminRolesController'?{code:'FORBIDDEN_ROLE',name:'No'}:{email:'forbidden@example.test',username:'forbidden'},update:row.controller.name==='AdminRolesController'?{name:'No'}:{username:'forbidden'},status:{status:'SUSPENDED'},roles:{roleIds:[]},permissions:{permissionCodes:[]}};
    assert.equal((await api(method,url,bodies[row.name]||{},ids.editor)).status,403,url);
   }
   await pool.query('DELETE FROM public.role_permissions WHERE role_id=$1',[ordinary]);
  });
  await t.test('role create/update metadata, catalogue and complete matrix via HTTP',async()=>{
   const created=await api('post','/api/admin/roles',{code:'CONTENT_EDITOR',name:'Editor',description:'Content editing'});assert.equal(created.status,201);role=created.body.id;
   assert.equal((await api('patch','/api/admin/roles/'+role,{name:'Content editor',description:null})).status,200);
   assert.equal((await api('get','/api/admin/roles')).body.some(r=>r.id===role&&r.name==='Content editor'),true);
   const perms=await api('get','/api/admin/permissions');assert.equal(perms.status,200);assert.equal(perms.body.length,70);
   assert.equal((await api('put','/api/admin/roles/'+role+'/permissions',{permissionCodes:['users.read','vocabulary.read']})).status,200);
   const matrix=await api('get','/api/admin/roles/matrix');assert.equal(matrix.status,200);assert.equal(matrix.body.permissions.length,70);assert.equal(matrix.body.grants.filter(g=>g.roleId===role).length,2);
  });
  await t.test('create pending account + membership + hashed token + audit atomically; never creates learner or password',async()=>{
   const before=Number((await pool.query('SELECT count(*) FROM public.users')).rows[0].count);
   const created=await api('post','/api/admin/admins',{email:' Pending@Example.test ',username:'pending',roleIds:[role]});assert.equal(created.status,201,JSON.stringify(created.body));pending=created.body.admin.id;
   assert.equal(created.body.admin.status,'PENDING_ACTIVATION');assert.equal(created.body.admin.roles[0].id,role);assert.equal(created.body.activation.delivery,'NOT_SCHEDULED');
   assert.equal(Number((await pool.query('SELECT count(*) FROM public.users')).rows[0].count),before);
   const admin=(await pool.query('SELECT * FROM public.admins WHERE id=$1',[pending])).rows[0];assert.equal(admin.password_hash,null);assert.equal(admin.created_by,ids.super);
   const activation=(await pool.query('SELECT *,extract(epoch FROM expires_at-created_at) AS ttl FROM public.admin_activation_tokens WHERE admin_id=$1',[pending])).rows[0];assert.match(activation.token_hash,/^[a-f0-9]{64}$/);assert.equal(Number(activation.ttl),3600);
   const audit=(await pool.query("SELECT payload FROM public.outbox_events WHERE aggregate_id=$1 AND payload->>'action'='ADMIN_INVITED'",[pending])).rows[0].payload;
   assert.equal(audit.after.activationTokenId,activation.id);assert(!JSON.stringify(audit).includes(activation.token_hash));assert(!/password|token_hash|rawToken/.test(JSON.stringify(created.body)));
   await http.post('/api/admin/auth/login').send({username:'pending',password:'any-password'}).expect(401);
   assert.equal((await api('patch','/api/admin/admins/'+pending+'/status',{status:'ACTIVE'})).status,400);
  });
  await t.test('list/search/filter/pagination, detail and profile update only expose safe fields',async()=>{
   const list=await api('get','/api/admin/admins?search=PENDING&status=PENDING_ACTIVATION&roleId='+role+'&page=1&limit=1');assert.equal(list.status,200);assert.equal(list.body.total,1);assert.equal(list.body.items[0].id,pending);
   const detail=await api('get','/api/admin/admins/'+pending);assert.equal(detail.status,200);assert.equal(detail.body.email,'pending@example.test');assert(!/password|token_hash|payload/.test(JSON.stringify(detail.body)));
   const before=await epoch(pending);
   const edit=await api('patch','/api/admin/admins/'+pending,{username:'pending-edited',email:'new-pending@example.test',avatarUrl:'https://example.test/avatar.png'});assert.equal(edit.status,200);assert.equal(edit.body.authVersion,before+1);
   const tokens=(await pool.query('SELECT revoked_at FROM public.admin_activation_tokens WHERE admin_id=$1',[pending])).rows;assert.equal(tokens.length,2);assert.equal(tokens.filter(r=>r.revoked_at===null).length,1);
   assert.equal((await api('get','/api/admin/admins?page=0')).status,400);assert.equal((await api('get','/api/admin/admins?limit=101')).status,400);assert.equal((await api('get','/api/admin/admins?status=INVALID')).status,400);
   assert.equal((await api('get','/api/admin/admins?search=%25')).body.total,0);
  });
  await t.test('duplicate canonical email/username and simultaneous create return 409 without partial data',async()=>{
   assert.equal((await api('post','/api/admin/admins',{email:'NEW-PENDING@example.test',username:'other'})).status,409);
   assert.equal((await api('post','/api/admin/admins',{email:'unique@example.test',username:'PENDING-EDITED'})).status,409);
   const results=await Promise.all([api('post','/api/admin/admins',{email:'race@example.test',username:'race1'}),api('post','/api/admin/admins',{email:'RACE@example.test',username:'race2'})]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
   assert.equal(Number((await pool.query("SELECT count(*) FROM public.admins WHERE email='race@example.test'")).rows[0].count),1);
   const rollback=await pool.query("SELECT count(*) FROM public.admins WHERE email='unique@example.test'");assert.equal(Number(rollback.rows[0].count),0);
  });
  await t.test('system role, system membership and IAM grant protection; no mass assignment or forged actor',async()=>{
   assert.equal((await api('patch','/api/admin/roles/'+superRole,{name:'Hacked'})).status,403);
   assert.equal((await api('put','/api/admin/roles/'+superRole+'/permissions',{permissionCodes:[]})).status,403);
   assert.equal((await api('put','/api/admin/roles/'+role+'/permissions',{permissionCodes:['admins.read']})).status,403);
   assert.equal((await api('put','/api/admin/admins/'+ids.editor+'/roles',{roleIds:[superRole]})).status,403);
   assert.equal((await api('put','/api/admin/admins/'+ids.super+'/roles',{roleIds:[]})).status,403);
   assert.equal((await api('post','/api/admin/admins',{email:'hacked@example.test',username:'hacked',roleIds:[superRole]})).status,403);
   for(const field of ['status','password','password_hash','auth_version','isSuperAdmin','created_by','actor','payload'])assert.equal((await api('post','/api/admin/admins',{email:'mass@example.test',username:'mass',[field]:'bad'})).status,400,field);
   assert.equal((await api('post','/api/admin/roles',{code:'MASS',name:'Mass',is_system:true})).status,400);
   assert.equal((await api('patch','/api/admin/admins/'+pending,{status:'ACTIVE'})).status,400);
   assert.equal((await api('put','/api/admin/admins/'+pending+'/roles',{roleIds:'bad'})).status,400);
   assert.equal((await api('put','/api/admin/roles/'+role+'/permissions',{permissionCodes:['unknown.read']})).status,400);
   assert.equal((await api('post','/api/admin/roles',{code:'SUPER_ADMIN',name:'No'})).status,403);
   const forged=await token(ids.editor,{permissions:['roles.read'],isSuperAdmin:true});await http.get('/api/admin/roles').set('Authorization','Bearer '+forged).expect(403);
  });
  await t.test('audit failure rolls back pending account, memberships and invitation; duplicate profile update leaves hash intact',async()=>{
   await pool.query(`ALTER TABLE public.outbox_events ADD CONSTRAINT phase3_fault CHECK (event_type<>'identity.admin.authorization_changed.v1') NOT VALID`);
   assert.equal((await api('post','/api/admin/admins',{email:'rollback@example.test',username:'rollback',roleIds:[role]})).status,500);
   await pool.query('ALTER TABLE public.outbox_events DROP CONSTRAINT phase3_fault');
   assert.equal(Number((await pool.query("SELECT count(*) FROM public.admins WHERE email='rollback@example.test'")).rows[0].count),0);
   const orphans=(await pool.query('SELECT count(*) FROM public.admin_activation_tokens t LEFT JOIN public.admins a ON a.id=t.admin_id WHERE a.id IS NULL')).rows[0].count;assert.equal(Number(orphans),0);
   assert.equal((await api('patch','/api/admin/admins/'+pending,{email:'super@example.test'})).status,409);
   assert.equal((await pool.query('SELECT password_hash FROM public.admins WHERE id=$1',[ids.super])).rows[0].password_hash,digest);
  });
  await t.test('membership grant/revoke and permission changes revoke old JWT/refresh for all affected admins',async()=>{
   const old=await token(ids.editor);
   assert.equal((await api('put','/api/admin/admins/'+ids.editor+'/roles',{roleIds:[role]})).status,200);
   await http.get('/api/admin/auth/me').set('Authorization','Bearer '+old).expect(401);
   const stale=await token(ids.editor),pendingEpoch=await epoch(pending);
   const changed=await api('put','/api/admin/roles/'+role+'/permissions',{permissionCodes:['users.read']});assert.equal(changed.status,200);assert.equal(await epoch(pending),pendingEpoch+1);
   await http.get('/api/admin/auth/me').set('Authorization','Bearer '+stale).expect(401);
   const refresh=await jwt.signAsync(await claims(ids.editor),{secret:configValues.JWT_REFRESH_SECRET});
   assert.equal((await api('put','/api/admin/admins/'+ids.editor+'/roles',{roleIds:[]})).status,200);
   await http.post('/api/admin/auth/refresh-token').send({refreshToken:refresh}).expect(401);
  });
  await t.test('lock/unlock revokes epochs, pending cannot activate; last Super Admin cannot be locked or demoted',async()=>{
   const old=await token(ids.editor);
   assert.equal((await api('patch','/api/admin/admins/'+ids.editor+'/status',{status:'SUSPENDED'})).status,200);
   await http.get('/api/admin/auth/me').set('Authorization','Bearer '+old).expect(401);
   assert.equal((await api('patch','/api/admin/admins/'+ids.editor+'/status',{status:'ACTIVE'})).status,200);
   await http.get('/api/admin/auth/me').set('Authorization','Bearer '+old).expect(401);
   assert.equal((await api('patch','/api/admin/admins/'+ids.super+'/status',{status:'DISABLED'})).status,403);
   assert.equal((await api('put','/api/admin/admins/'+ids.super+'/roles',{roleIds:[]})).status,403);
  });
  await t.test('concurrent HTTP mutations preserve at least one active Super Admin',async()=>{
   // Test fixture only; ordinary API cannot grant this membership.
   await pool.query('INSERT INTO public.admin_roles(admin_id,role_id) VALUES($1,$2)',[ids.second,superRole]);
   const a=await token(ids.super),b=await token(ids.second);
   const results=await Promise.all([
    http.patch('/api/admin/admins/'+ids.second+'/status').set('Authorization','Bearer '+a).send({status:'SUSPENDED'}),
    http.patch('/api/admin/admins/'+ids.super+'/status').set('Authorization','Bearer '+b).send({status:'SUSPENDED'}),
   ]);
   assert.equal(results.filter(r=>r.status===200).length,1);assert(results.some(r=>[401,403].includes(r.status)));
   assert.equal(Number((await pool.query("SELECT count(*) FROM public.admins a JOIN public.admin_roles ar ON ar.admin_id=a.id WHERE ar.role_id=$1 AND a.status='ACTIVE' AND NOT a.is_deleted",[superRole])).rows[0].count),1);
  });
  await t.test('learner login and refresh still work without auth_version',async()=>{
   const login=await http.post('/api/auth/login').send({email:learner.email,password:'phase3-fixture-password'}).expect(201);
   const decoded=await jwt.verifyAsync(login.body.accessToken,{secret:configValues.JWT_ACCESS_SECRET});assert.equal(decoded.role,'USER');assert.equal(decoded.auth_version,undefined);
   const refresh=await jwt.signAsync({_id:learner._id,email:learner.email,role:'USER'},{secret:configValues.JWT_REFRESH_SECRET});
   await http.post('/api/auth/refresh-token').set('Cookie','user_refresh_token='+refresh).send({}).expect(201);
  });
 } finally {if(app)await app.close();await pool.end();}
});
