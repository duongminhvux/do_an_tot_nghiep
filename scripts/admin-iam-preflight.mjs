/** Read-only production inventory; never prints secret values or admin credentials. */
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
const out='.tmp/admin-iam-phase6';mkdirSync(out,{recursive:true});
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:8*1024*1024}).trim();
const names=docker('ps','-a','--format','{{.Names}}').split('\n').filter(n=>n.startsWith('vocalearn-postgres-'));
const records=JSON.parse(docker('inspect',...names));
const envOf=c=>Object.fromEntries(c.Config.Env.map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]}));
const secretNames=['JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','INTERNAL_SERVICE_TOKEN','IDENTITY_INTERNAL_TOKEN','ADMIN_ACTIVATION_TOKEN_KEY','MAIL_USERNAME','MAIL_PASSWORD'];
const services=records.map(c=>{const env=envOf(c);return {name:c.Name.slice(1),id:c.Id,image:c.Config.Image,imageId:c.Image,state:c.State.Status,health:c.State.Health?.Status,startedAt:c.State.StartedAt,secrets:Object.fromEntries(secretNames.map(k=>[k,{present:!!env[k],length:env[k]?.length||0}])),activation:{delivery:env.ADMIN_ACTIVATION_DELIVERY_ENABLED||'false (unset)',consumerReady:env.ADMIN_ACTIVATION_CONSUMER_READY||'false (unset)',worker:env.ADMIN_ACTIVATION_EMAIL_WORKER_ENABLED||'false (unset)',adminWebUrl:env.ADMIN_WEB_URL||null},seed:{enabled:env.ADMIN_SEED_ENABLED||null,weakPassword:env.ADMIN_SEED_ALLOW_WEAK_PASSWORD||null}};});
const identity=records.find(c=>c.Name.endsWith('-identity-service-1'));const ie=envOf(identity);
const consistency=Object.fromEntries(['JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','INTERNAL_SERVICE_TOKEN','IDENTITY_INTERNAL_TOKEN'].map(key=>[key,records.filter(c=>envOf(c)[key]).every(c=>envOf(c)[key]===ie[key])]));
const inventory={at:new Date().toISOString(),services,consistency};writeFileSync(out+'/preflight-services.json',JSON.stringify(inventory,null,2));
console.log(JSON.stringify({services:services.map(({name,state,health})=>({name,state,health})),identity:{secrets:services.find(s=>s.name.endsWith('-identity-service-1')).secrets,activation:services.find(s=>s.name.endsWith('-identity-service-1')).activation},consistency},null,2));
