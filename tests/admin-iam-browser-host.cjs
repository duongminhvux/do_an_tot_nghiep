/** Phase 4: real two-owner PostgreSQL + relay/consumer + internal HTTP + fake SMTP. */
const assert=require('node:assert/strict'),path=require('node:path');
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

(async()=>{
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
  for(let i=1;i<=12;i++)await pool.query("INSERT INTO public.admins(email,username) VALUES($1,$2)",['page'+i+'@example.test','page'+i]);
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
  app=module.createNestApplication({logger:false});app.enableCors({origin:'http://127.0.0.1:56902',credentials:true});app.use(req('cookie-parser')());
  app.use((req,res,next)=>{if(req.method==='GET'&&req.path==='/api/site-settings')return res.json({statusCode:200,data:{siteName:'Vocalearn IAM Test'}});next();});
  const {TransformInterceptor}=src('common/interceptors/transform.interceptor.ts');app.useGlobalInterceptors(new TransformInterceptor());app.setGlobalPrefix('api');await app.listen(56901,'127.0.0.1');
  configValues.IDENTITY_INTERNAL_URL=await app.getUrl();
  const http=request(app.getHttpServer()),jwt=app.get(JwtService);
  const {AdminActivationEmailWorker}=src('modules/gmail/admin-activation-email.worker.ts');
  const worker=new AdminActivationEmailWorker(createConnection(notificationPool),{get:key=>key==='ADMIN_ACTIVATION_EMAIL_WORKER_ENABLED'?'true':config.get(key)});
  const pipeline=mode=>{const {spawnSync}=require('node:child_process');const result=spawnSync('python',['tests/admin-iam-delivery-pipeline.py',mode],{encoding:'utf8',env:{...process.env,PYTHONPATH:process.env.ADMIN_IAM_PYTHONPATH,PGDATABASE:'identity_db'}});return {status:result.status,output:result.stdout,errors:result.stderr};};
  const epoch=async id=>(await pool.query('SELECT auth_version FROM public.admins WHERE id=$1',[id])).rows[0].auth_version;
  const claims=async id=>({_id:id,role:'ADMIN',auth_version:await epoch(id)});
  const token=async(id=ids.super,extra={})=>jwt.signAsync({...await claims(id),...extra},{secret:configValues.JWT_ACCESS_SECRET,expiresIn:'10m'});
  const api=async(method,url,body,id=ids.super)=>http[method](url).set('Authorization','Bearer '+await token(id)).send(body);

  process.send?.({ready:true,url:await app.getUrl()});
  await new Promise(resolve=>{
   process.on('message',async message=>{
    try {
     let result;
     if(message.action==='stop'){process.send?.({requestId:message.requestId,ok:true});resolve();return;}
     if(message.action==='expiredAccess'){
      result={accessToken:await jwt.signAsync(await claims(ids.super),{secret:configValues.JWT_ACCESS_SECRET,expiresIn:-1})};
     } else if(message.action==='age'){
      await pool.query("UPDATE public.admin_activation_tokens SET created_at=created_at-interval '61 seconds',expires_at=expires_at-interval '61 seconds' WHERE admin_id=(SELECT id FROM public.admins WHERE email=$1)",[message.email]);result={aged:true};
     } else if(message.action==='deliver'){
      const delivery=pipeline('drain');if(delivery.status!==0)throw Error('Test pipeline failed');
      for(let i=0;i<50&&await worker.runOnce();i++);
      const mail=sent.filter(item=>item.to===message.email).at(-1);if(!mail)throw Error('No sandbox email');
      const link=/href="([^"]+)"/.exec(mail.html)[1].replaceAll('&amp;','&');result={token:new URLSearchParams(new URL(link).hash.slice(1)).get('token')};
     } else if(message.action==='account'){
      result=(await pool.query('SELECT id,status,auth_version FROM public.admins WHERE email=$1',[message.email])).rows[0];
     } else throw Error('Unknown test control');
     process.send?.({requestId:message.requestId,result});
    } catch {process.send?.({requestId:message.requestId,error:'Test control failed'});}
   });
  });
 } finally {if(app)await app.close();if(notificationApp)await notificationApp.close();await pool.end();await notificationPool.end();if(originalInternalToken===undefined)delete process.env.INTERNAL_SERVICE_TOKEN;else process.env.INTERNAL_SERVICE_TOKEN=originalInternalToken;}
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>{process.disconnect?.();});
