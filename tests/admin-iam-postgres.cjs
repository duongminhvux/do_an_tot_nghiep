/** Real PostgreSQL integration. NEVER targets the application cluster.
 * ADMIN_IAM_TEST_PORT is mandatory; dedicated cluster_name and non-production port are verified.
 * Destroys/recreates ONLY public in the isolated test identity_db to test fresh + upgrade paths.
 */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),req=createRequire(path.join(root,'apps/api/package.json'));
req('reflect-metadata');
const {Pool}=req('pg'),bcrypt=req('bcrypt'),load=require('./helpers/load-typescript.cjs');
const {createConnection}=load(path.join(root,'apps/api/src/postgres/connection.ts'));
const {RbacRepository}=load(path.join(root,'apps/api/src/modules/admins/rbac.repository.ts'));
const {AdminRbacService}=load(path.join(root,'apps/api/src/modules/admins/admin-rbac.service.ts'));
const {AdminsService}=load(path.join(root,'apps/api/src/modules/admins/admins.service.ts'));
const {PERMISSION_CATALOGUE}=load(path.join(root,'apps/api/src/modules/admins/permission-catalogue.ts'));
const {JwtStrategy}=load(path.join(root,'apps/api/src/modules/auth/strategy/jwt.strategy.ts'));
const {IdentityIntrospectionController}=load(path.join(root,'apps/api/src/modules/auth/identity-introspection.controller.ts'));
const {AdminAuthController}=load(path.join(root,'apps/api/src/modules/auth/admin-auth.controller.ts'));
const fixtureId='11111111-1111-4111-8111-111111111111',deletedId='22222222-2222-4222-8222-222222222222';
const pendingId='33333333-3333-4333-8333-333333333333';
const expectedCodes=PERMISSION_CATALOGUE.map(p=>p.code).sort();
const i18n={t:async key=>key};

test('Admin IAM Phase 1 on isolated PostgreSQL 17',async t=>{
 const port=Number(process.env.ADMIN_IAM_TEST_PORT);
 assert(Number.isInteger(port)&&port>1024&&port!==5432,'Explicit isolated ADMIN_IAM_TEST_PORT required');
 const config={host:'127.0.0.1',port,database:'identity_db',user:'vl_identity',password:process.env.ADMIN_IAM_TEST_PASSWORD,connectionTimeoutMillis:5000};
 assert(config.password,'Explicit ADMIN_IAM_TEST_PASSWORD required');
 const pool=new Pool(config),client=await pool.connect();
 try{
  assert.equal((await client.query('SHOW cluster_name')).rows[0].cluster_name,'admin-iam-phase1-test','Refusing non-test cluster');
  assert.equal((await client.query(`SELECT current_database() AS db`)).rows[0].db,'identity_db');
  const version=(await client.query(`SELECT version() AS version`)).rows[0].version;
  assert.match(version,/PostgreSQL 17\./);console.log('REAL TEST SERVER:',version.split(' on ')[0],'; cluster=admin-iam-phase1-test; port='+port);
  const {migrate,migrationsFor,schemaFingerprint}=await import('../apps/api/src/postgres/migrations.ts');
  const {bootstrapSuperAdmin,parseBootstrapOptions}=await import('../apps/api/src/scripts/bootstrap-super-admin-core.mjs');
  const {seedAdminSql,parseSeedOptions}=await import('../apps/api/src/scripts/seed-admin-core.mjs');
  const reset=async()=>{await client.query('DROP SCHEMA public CASCADE');await client.query('CREATE SCHEMA public AUTHORIZATION vl_identity');};
  const q=async(sql,values)=> (await client.query(sql,values)).rows;
  const rejectsSql=async(sql,values,code='23514')=>assert.rejects(client.query(sql,values),error=>error.code===code);
  const snapshot=()=>q(`SELECT id,email,username,avatar_url,is_deleted,deleted_at,password_hash,payload,created_at,updated_at FROM public.admins ORDER BY id`);
  let digest,original;
  const installLegacy=async()=>{
   await reset();await client.query('BEGIN');
   await client.query('CREATE TABLE public.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,fingerprint text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
   for(const m of (await migrationsFor('identity')).filter(m=>m.version<'0019')){
    await client.query(m.sql);await client.query(`INSERT INTO public.schema_migrations(version,checksum,fingerprint) VALUES($1,$2,$3)`,[m.version,m.checksum,await schemaFingerprint(client)]);
   }
   await client.query('COMMIT');
   assert.equal(await schemaFingerprint(client),'1379b6ee30b9e2e9e912941ef9bc609082ec43f8d902306e6e123a42798b273c','Legacy test schema must match the read-only production-schema fingerprint');
  };
  await t.test('fresh migrate seeds exactly 70 permissions and system role, no accounts/memberships',async()=>{
   await reset();const result=await migrate(pool,'identity');assert.equal(result.current,'0020_admin_activation_tokens');
   assert.deepEqual((await q(`SELECT code FROM public.permissions ORDER BY code`)).map(r=>r.code),expectedCodes);
   assert.equal((await q(`SELECT count(*)::int AS n FROM public.roles WHERE code='SUPER_ADMIN' AND is_system`))[0].n,1);
   assert.equal((await q(`SELECT count(*)::int AS n FROM public.role_permissions`))[0].n,70);
   assert.equal((await q(`SELECT count(*)::int AS n FROM public.admins`))[0].n,0);
   assert.equal((await q(`SELECT count(*)::int AS n FROM public.admin_roles`))[0].n,0);
   const again=await migrate(pool,'identity');assert.deepEqual(again.pending,[]);assert.equal(again.ready,true);
  });
  await t.test('legacy duplicate preflight rolls back the entire upgrade without rewriting data',async()=>{
   await installLegacy();
   await client.query(`INSERT INTO public.admins(email,username,password_hash) VALUES('first@example.test','Same','unchanged'),('second@example.test','same','unchanged')`);
   const before=await snapshot();
   await assert.rejects(migrate(pool,'identity'),/canonical identity duplicates/);
   assert.deepEqual(await snapshot(),before);
   assert.equal((await q(`SELECT to_regclass('public.roles') AS roles`))[0].roles,null);
   assert.equal((await q(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='admins' AND column_name='status'`))[0].n,0);
   assert.equal((await q(`SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1`))[0].version,'0009_numeric_collation');
  });
  await t.test('upgrade old schema preserves all legacy data, hashes and timestamps without grants',async()=>{
   await installLegacy();digest=await bcrypt.hash('isolated-fixture-password',4);
   await client.query(`INSERT INTO public.admins(id,email,username,password_hash,payload,created_at,updated_at,is_deleted,deleted_at)
    VALUES($1,'fixture@example.test','fixture',$3,$4::jsonb,'2025-01-01Z','2025-01-02Z',false,NULL),
     ($2,'deleted@example.test','deleted',$3,$4::jsonb,'2025-01-01Z','2025-01-02Z',true,'2025-01-03Z')`,
    [fixtureId,deletedId,digest,JSON.stringify({custom:'preserve',password:digest,status:'SUSPENDED',authVersion:999})]);
   original=await snapshot();await migrate(pool,'identity');assert.deepEqual(await snapshot(),original);
   const states=await q(`SELECT status,auth_version FROM public.admins ORDER BY id`);
   assert.deepEqual(states,[{status:'ACTIVE',auth_version:1},{status:'DISABLED',auth_version:1}]);
   assert.equal((await q(`SELECT count(*)::int AS n FROM public.admin_roles`))[0].n,0);
   assert.equal((await migrate(pool,'identity')).ready,true);
  });
  await t.test('canonical uniqueness, lifecycle and activation constraints are enforced by PostgreSQL',async()=>{
   const ins='INSERT INTO public.admins(email,username,password_hash,status) VALUES($1,$2,$3,$4)';
   await rejectsSql(ins,['fixture@example.test','other',digest,'ACTIVE'],'23505');
   await rejectsSql(ins,['other@example.test','FIXTURE',digest,'ACTIVE'],'23505');
   await rejectsSql(ins,['UPPER@example.test','upper',digest,'ACTIVE']);
   await rejectsSql(ins,['space@example.test','bad name',digest,'ACTIVE']);
   await rejectsSql(ins,['shape@example.test','other@example.test',digest,'ACTIVE']);
   await rejectsSql(ins,['empty@example.test','empty',null,'ACTIVE']);
   await rejectsSql(ins,['pendinghash@example.test','pendinghash',digest,'PENDING_ACTIVATION']);
   await rejectsSql(ins,['status@example.test','status',digest,'INVALID']);
   await client.query(`INSERT INTO public.admins(id,email,username) VALUES($1,'pending@example.test','pending')`,[pendingId]);
   assert.deepEqual((await q(`SELECT status,password_hash FROM public.admins WHERE id=$1`,[pendingId]))[0],{status:'PENDING_ACTIVATION',password_hash:null});
   await rejectsSql(`UPDATE public.admins SET auth_version=0 WHERE id=$1`,[fixtureId]);
   await rejectsSql(`UPDATE public.admins SET is_deleted=true WHERE id=$1`,[fixtureId]);
   const addToken='INSERT INTO public.admin_activation_tokens(admin_id,token_hash) VALUES($1,$2) RETURNING *';
   const [token]=await q(addToken,[pendingId,'a'.repeat(64)]);
   assert.equal(token.expires_at-token.created_at,3600000);
   await rejectsSql(addToken,[pendingId,'b'.repeat(64)],'23505');
   await rejectsSql(`UPDATE public.admin_activation_tokens SET expires_at=created_at+interval '59 minutes' WHERE id=$1`,[token.id]);
   await rejectsSql(`UPDATE public.admin_activation_tokens SET used_at=now(),revoked_at=now() WHERE id=$1`,[token.id]);
   await client.query(`UPDATE public.admin_activation_tokens SET revoked_at=now() WHERE id=$1`,[token.id]);
   await q(addToken,[pendingId,'b'.repeat(64)]);
  });
  const repository=new RbacRepository(createConnection(pool)),rbac=new AdminRbacService(repository),admins=new AdminsService(createConnection(pool),i18n,rbac);
  await t.test('repository and resolver support multiple roles, deduplication and empty permissions',async()=>{
   assert.equal((await repository.listPermissions()).length,70);
   assert.equal((await repository.findRoleByCode('SUPER_ADMIN')).isSystem,true);
   assert.deepEqual(await rbac.getEffectivePermissions(fixtureId),[]);
   assert.deepEqual(await rbac.getEffectivePermissions('99999999-9999-4999-8999-999999999999'),[]);
   await client.query(`INSERT INTO public.roles(code,name) VALUES('FIXTURE_READ','Read'),('FIXTURE_EDIT','Edit')`);
   await client.query(`INSERT INTO public.role_permissions(role_id,permission_id)
    SELECT r.id,p.id FROM public.roles r CROSS JOIN public.permissions p
    WHERE (r.code='FIXTURE_READ' AND p.code='users.read') OR (r.code='FIXTURE_EDIT' AND p.code IN ('users.read','users.update'))`);
   await client.query(`INSERT INTO public.admin_roles(admin_id,role_id) SELECT $1::uuid,id FROM public.roles WHERE code IN ('FIXTURE_READ','FIXTURE_EDIT')`,[fixtureId]);
   assert.equal((await repository.listAdminRoles(fixtureId)).length,2);
   assert.deepEqual(await rbac.getEffectivePermissions(fixtureId),['users.read','users.update']);
   await client.query(`DELETE FROM public.role_permissions rp USING public.permissions p WHERE rp.permission_id=p.id AND p.code='users.update'`);
   assert.deepEqual(await rbac.getEffectivePermissions(fixtureId),['users.read']);
   await client.query(`INSERT INTO public.role_permissions(role_id,permission_id) SELECT r.id,p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.code='FIXTURE_EDIT' AND p.code='users.update'`);
   await client.query(`UPDATE public.admins SET status='SUSPENDED' WHERE id=$1`,[fixtureId]);
   assert.deepEqual(await rbac.getEffectivePermissions(fixtureId),[]);
   assert.equal((await rbac.resolveAdminAccess(fixtureId)).isSuperAdmin,false);
   await client.query(`UPDATE public.admins SET status='ACTIVE' WHERE id=$1`,[fixtureId]);
  });
  await t.test('login and token-validation paths reject inactive or passwordless admins',async()=>{
   const safe=await admins.validateAdmin('fixture','isolated-fixture-password');assert.equal(safe.status,'ACTIVE');assert.equal(Object.hasOwn(safe,'password'),false);
   assert.equal(await admins.getAuthVersion(fixtureId),1);
   await assert.rejects(admins.validateAdmin('pending','any-password'));
   await assert.rejects(admins.validateAdmin('deleted','isolated-fixture-password'));
   await assert.rejects(admins.validateAdmin('fixture','wrong-password'));
   const config={get:key=>({JWT_ACCESS_SECRET:'isolated-access',JWT_REFRESH_SECRET:'isolated-refresh',IDENTITY_INTERNAL_TOKEN:'isolated-internal-secret-at-least-24'}[key]),getOrThrow:key=>'isolated-access'};
   const strategy=new JwtStrategy(config,{},admins);
   const introspect=new IdentityIntrospectionController({verifyAsync:async()=>({_id:pendingId,role:'ADMIN'})},config,{},admins);
   const refresh=new AdminAuthController({},config,i18n,admins,{verifyAsync:async()=>({_id:pendingId,role:'ADMIN'})});
   await assert.rejects(strategy.validate({_id:pendingId,role:'ADMIN'}));
   await assert.rejects(introspect.introspect('isolated-internal-secret-at-least-24','fixture-token'));
   await assert.rejects(refresh.refreshToken({},'fixture-refresh',{}));
   for(const status of ['SUSPENDED','DISABLED']){
    await client.query(`UPDATE public.admins SET status=$2 WHERE id=$1`,[fixtureId,status]);
    await assert.rejects(admins.validateAdmin('fixture','isolated-fixture-password'));
    await assert.rejects(strategy.validate({_id:fixtureId,role:'ADMIN'}));
   }
   await client.query(`UPDATE public.admins SET status='ACTIVE' WHERE id=$1`,[fixtureId]);
  });
  const args=['--admin-id',fixtureId,'--expected-email','fixture@example.test','--expected-username','fixture'];
  await t.test('bootstrap requires explicit identity and dry-run performs zero writes',async()=>{
   assert.throws(()=>parseBootstrapOptions([]),/admin-id/);assert.throws(()=>parseBootstrapOptions(['--admin-id',fixtureId]),/expected/);
   const before=await snapshot(),count=(await q(`SELECT count(*)::int AS n FROM public.outbox_events`))[0].n;
   assert.equal((await bootstrapSuperAdmin(client,parseBootstrapOptions([...args,'--dry-run']))).status,'would-assign');
   assert.deepEqual(await snapshot(),before);assert.equal((await q(`SELECT count(*)::int AS n FROM public.outbox_events`))[0].n,count);
   assert.equal((await q(`SELECT count(*)::int AS n FROM public.admin_roles ar JOIN public.roles r ON r.id=ar.role_id WHERE r.code='SUPER_ADMIN'`))[0].n,0);
   await assert.rejects(bootstrapSuperAdmin(client,{...parseBootstrapOptions(args),expectedEmail:'wrong@example.test'}),/mismatch/);
   await assert.rejects(bootstrapSuperAdmin(client,{...parseBootstrapOptions(args),adminId:pendingId,expectedEmail:'pending@example.test',expectedUsername:'pending'}),/ACTIVE/);
   const cli=spawnSync(process.execPath,['apps/api/src/scripts/bootstrap-super-admin.mjs',...args,'--dry-run'],{cwd:root,encoding:'utf8',env:{...process.env,DATABASE_URL:'',PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'vl_identity',PGPASSWORD:config.password}});
   assert.equal(cli.status,0,cli.stderr);assert.equal(JSON.parse(cli.stdout).status,'would-assign');assert.deepEqual(await snapshot(),before);
  });
  await t.test('bootstrap apply on synthetic TEST fixture is atomic, audited and idempotent',async()=>{
   const opts=parseBootstrapOptions([...args,'--apply']);
   const {rows:[before]}=await client.query(`SELECT password_hash FROM public.admins WHERE id=$1`,[fixtureId]);
   // Force outbox failure in a test transaction: membership and epoch must roll back.
   await client.query(`ALTER TABLE public.outbox_events ADD CONSTRAINT fixture_block_bootstrap CHECK(event_type<>'identity.admin.super_admin_bootstrapped.v1')`);
   await assert.rejects(bootstrapSuperAdmin(client,opts));
   assert.equal(await admins.getAuthVersion(fixtureId),1);
   assert.equal((await rbac.resolveAdminAccess(fixtureId)).isSuperAdmin,false);
   await client.query('ALTER TABLE public.outbox_events DROP CONSTRAINT fixture_block_bootstrap');
   const result=await bootstrapSuperAdmin(client,opts);assert.equal(result.status,'assigned');assert.equal(result.authVersion,2);
   assert.equal((await q(`SELECT password_hash FROM public.admins WHERE id=$1`,[fixtureId]))[0].password_hash,before.password_hash);
   assert.deepEqual(await rbac.getEffectivePermissions(fixtureId),expectedCodes);
   assert.equal((await q(`SELECT count(*)::int AS n FROM public.outbox_events WHERE event_type='identity.admin.super_admin_bootstrapped.v1'`))[0].n,1);
   assert.equal((await bootstrapSuperAdmin(client,opts)).status,'already-assigned');assert.equal(await admins.getAuthVersion(fixtureId),2);
   await assert.rejects(bootstrapSuperAdmin(client,{...opts,adminId:deletedId,expectedEmail:'deleted@example.test',expectedUsername:'deleted'}),/ACTIVE/);
   await client.query(`INSERT INTO public.admins(email,username,password_hash,status) VALUES('other@example.test','other',$1,'ACTIVE')`,[digest]);
   const [other]=await q(`SELECT id FROM public.admins WHERE username='other'`);
   await assert.rejects(bootstrapSuperAdmin(client,{...opts,adminId:other.id,expectedEmail:'other@example.test',expectedUsername:'other'}),/already exists/);
  });
  await t.test('seed lifecycle/version SQL works on PostgreSQL without granting membership',async()=>{
   const env={DEFAULT_ADMIN_EMAIL:'seed@example.test',DEFAULT_ADMIN_USERNAME:'seedfixture',DEFAULT_ADMIN_PASSWORD:'fixture-seed-password-strong'};
   const opts=parseSeedOptions([],env);
   await client.query('BEGIN');await seedAdminSql(client,opts,bcrypt.hash);await client.query('COMMIT');
   const [seed]=await q(`SELECT * FROM public.admins WHERE email='seed@example.test'`);assert.equal(seed.status,'ACTIVE');assert.equal(seed.auth_version,1);
   await client.query('BEGIN');await seedAdminSql(client,opts,bcrypt.hash);await client.query('COMMIT');
   assert.equal((await q(`SELECT password_hash FROM public.admins WHERE id=$1`,[seed.id]))[0].password_hash,seed.password_hash);
   assert.equal((await q(`SELECT count(*)::int AS n FROM public.admin_roles WHERE admin_id=$1`,[seed.id]))[0].n,0);
   await client.query('BEGIN');await seedAdminSql(client,{...opts,resetPassword:true},bcrypt.hash);await client.query('COMMIT');
   assert.equal(await admins.getAuthVersion(seed.id),2);
   await client.query('BEGIN');await assert.rejects(seedAdminSql(client,{...opts,email:'pending@example.test',username:'pending',resetPassword:true},bcrypt.hash),/pending invitation/);await client.query('ROLLBACK');
  });
  await t.test('migration runner remains ready with data and refuses metadata drift',async()=>{
   assert.equal((await migrate(pool,'identity',false)).ready,true);assert.equal((await migrate(pool,'identity')).ready,true);
   await client.query('ALTER TABLE public.roles ADD COLUMN fixture_drift text');
   await assert.rejects(migrate(pool,'identity',false),/schema drift/);
   await client.query('ALTER TABLE public.roles DROP COLUMN fixture_drift');
   assert.equal((await migrate(pool,'identity',false)).ready,true);
  });
 }finally{client.release();await pool.end();}
});
