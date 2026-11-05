import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {req,db,compose,docker,http,waitFor,stageEnv,project} from './admin-iam-stage-lib.mjs';
const identity=await db('identity');
try{
 await waitFor(async()=>{try{return (await http('/gateway/identity-ready')).status===200;}catch{return false;}},'identity readiness');
 const {rows:[count]}=await identity.query('SELECT count(*)::int AS n FROM admins');assert.equal(count.n,0,'Bootstrap fixture requires a fresh staging database');
 const bcrypt=req('bcrypt');const digest=await bcrypt.hash('Stage-Super-Password123!',10);const adminId='60000000-0000-4000-8000-000000000001';
 await identity.query(`INSERT INTO admins(id,email,username,password_hash,status) VALUES($1,'stage-super@example.test','stage-super',$2,'ACTIVE')`,[adminId,digest]);
 await identity.query(`INSERT INTO users(id,email,username,password_hash,is_verified,auth_provider) VALUES('60000000-0000-4000-8000-000000000002','learner@example.test','stage-learner',$1,true,'local')`,[digest]);
 const cli=['exec',project+'-identity-service-1','node','apps/api/src/scripts/bootstrap-super-admin.mjs','--admin-id',adminId,'--expected-email','stage-super@example.test','--expected-username','stage-super'];
 docker([...cli,'--dry-run']);assert.equal(Number((await identity.query('SELECT count(*) FROM admin_roles')).rows[0].count),0);
 docker([...cli,'--apply']);assert.equal(Number((await identity.query('SELECT count(*) FROM admin_roles')).rows[0].count),1);
 await waitFor(async()=>{const notification=await db('notification');try{return Number((await notification.query("SELECT count(*) FROM activitylogs WHERE action='SUPER_ADMIN_BOOTSTRAPPED'")).rows[0].count)===1;}finally{await notification.end();}},'bootstrap audit projection');
 const mgmt=await fetch('http://127.0.0.1:57673/api/queues/%2F/notification',{headers:{Authorization:'Basic '+Buffer.from('iamstage:'+stageEnv.RABBITMQ_PASSWORD).toString('base64')}});const queue=await mgmt.json();assert(queue.consumers>=1,'New consumer must be running before producer');
 let env=readFileSync('.tmp/admin-iam-phase6/stage.env','utf8');for(const key of ['STAGING_DELIVERY_ENABLED','STAGING_WORKER_ENABLED','STAGING_CONSUMER_READY'])env=env.replace(new RegExp('^'+key+'=.*$','m'),key+'=true');writeFileSync('.tmp/admin-iam-phase6/stage.env',env);
 compose('up','-d','--no-deps','identity-service','notification-service');
 await waitFor(async()=>{try{return (await http('/gateway/identity-ready')).status===200&&(await http('/gateway/notification-ready')).status===200;}catch{return false;}},'services after staging-only flags');
 writeFileSync('.tmp/admin-iam-phase6/staging-bootstrap.json',JSON.stringify({explicitAdminId:adminId,dryRunNoWrites:true,appliedOnlyToStaging:true,auditProjected:true,consumerVerifiedBeforeProducer:true},null,2));
 console.log('Staging bootstrap, durable audit and consumer-before-producer gate PASS');
}finally{await identity.end();}
