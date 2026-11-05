const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');const root=path.resolve(__dirname,'..');const req=createRequire(path.join(root,'apps/api/package.json'));req('reflect-metadata');
const {RequestMethod}=req('@nestjs/common');const {PATH_METADATA,METHOD_METADATA}=req('@nestjs/common/constants');
const load=require('./helpers/load-typescript.cjs');const auth=path.join(root,'apps/api/src/modules/auth');
const {ADMIN_ROUTE_POLICIES,IAM_ROUTE_POLICIES,ACTIVATION_ROUTE_POLICIES}=load(path.join(auth,'admin-route-policy.manifest.ts'));
const {PERMISSIONS_KEY,CONDITION_KEY,EXEMPTION_KEY,ADMIN_CONTROLLER_KEY}=load(path.join(auth,'decorators/require-permissions.decorator.ts'));
const reviewed=[...ADMIN_ROUTE_POLICIES,...IAM_ROUTE_POLICIES,...ACTIVATION_ROUTE_POLICIES];
const controllers=new Set();
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory()){walk(f);continue;}if(!f.endsWith('.ts')||f.endsWith('.spec.ts'))continue;const text=fs.readFileSync(f,'utf8');if(!/@(?:AdminController|Controller)\(/.test(text))continue;for(const value of Object.values(load(f)))if(typeof value==='function'&&Reflect.hasMetadata(PATH_METADATA,value))controllers.add(value);}}
walk(path.join(root,'apps/api/src'));
const routes=[];
for(const controller of controllers){const prefixes=[Reflect.getMetadata(PATH_METADATA,controller)].flat();for(const name of Object.getOwnPropertyNames(controller.prototype)){const handler=controller.prototype[name];if(typeof handler!=='function'||!Reflect.hasMetadata(METHOD_METADATA,handler))continue;const perms=Reflect.getMetadata(PERMISSIONS_KEY,handler),condition=Reflect.getMetadata(CONDITION_KEY,handler),exemption=Reflect.getMetadata(EXEMPTION_KEY,handler);const roles=Reflect.getMetadata('roles',handler)||Reflect.getMetadata('roles',controller)||[];
for(const prefix of prefixes){if(!Reflect.getMetadata(ADMIN_CONTROLLER_KEY,controller)&&!/^admin(?:\/|$)/.test(prefix)&&!roles.includes('ADMIN')&&!perms&&!condition&&!exemption)continue;
assert(perms?.length||exemption,'Unprotected administrative handler '+controller.name+'.'+name);for(const suffix of [Reflect.getMetadata(PATH_METADATA,handler)].flat()){const url='/api/'+[prefix,suffix].filter(x=>x&&x!=='/').join('/');const method=RequestMethod[Reflect.getMetadata(METHOD_METADATA,handler)].toUpperCase();const key=method+' '+url;const expected=reviewed.find(r=>r.method===method&&r.path===url);assert(expected,'Administrative route absent from reviewed policy manifest: '+key);assert.equal(condition,/\[(C\d)\]/.exec(expected.policy)?.[1]);assert.equal(exemption,/EXEMPT:(E\d)/.exec(expected.policy)?.[1]);assert.deepEqual([...(perms||[])].sort(),(expected.policy.match(/[a-z][a-z_]*(?:\.[a-z_]+)+/g)||[]).sort());routes.push({controller,handler,name,method,url,permissions:perms||[],condition,exemption});}}}}
const phase0=fs.readFileSync(path.join(root,'ADMIN_IAM_PHASE0.md'),'utf8');
const documented=[...phase0.matchAll(/^\| (GET(?: \(SSE\))?|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|ALL) \| `([^`]+)` \| `([^`]+)` \| `/gm)].map(m=>({method:m[1].replace(' (SSE)',''),path:m[2],policy:m[3]}));
assert.deepEqual(documented,ADMIN_ROUTE_POLICIES.map(({method,path,policy})=>({method,path,policy})));
assert.equal(routes.length,250);assert.equal(new Set(routes.map(r=>r.method+' '+r.url)).size,250);assert.equal(ADMIN_ROUTE_POLICIES.length,235);assert.equal(IAM_ROUTE_POLICIES.length,12);
const iamRoutes=routes.filter(r=>IAM_ROUTE_POLICIES.some(p=>p.method===r.method&&p.path===r.url));
const activationRoutes=routes.filter(r=>ACTIVATION_ROUTE_POLICIES.some(p=>p.method===r.method&&p.path===r.url));
assert.equal(activationRoutes.length,3);
const phase0Routes=routes.filter(r=>!iamRoutes.includes(r)&&!activationRoutes.includes(r));
module.exports={controllers:[...new Set(phase0Routes.map(r=>r.controller))],routes:phase0Routes,iamRoutes,activationRoutes,allRoutes:routes};
if(require.main===module)console.log('PASS: 250 reviewed policies (247 previous + 3 Phase 4) match real runtime decorators, including shared aliases, factory and SSE; no unmapped administrative route.');
