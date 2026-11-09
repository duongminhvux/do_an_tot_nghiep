const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const load=require('./helpers/load-typescript.cjs');
const {canVisit,hasPermissions,canManageIam,firstAllowedPath,verifiedAdminProfile}=load('apps/admin-web/lib/admin-permissions.ts');
const {PERMISSION_CATALOGUE}=load('apps/api/src/modules/admins/permission-catalogue.ts');
const full={_id:'11111111-1111-4111-8111-111111111111',role:'ADMIN',status:'ACTIVE',authVersion:1,isSuperAdmin:true,permissions:PERMISSION_CATALOGUE.map(p=>p.code),roleCodes:['SUPER_ADMIN']};
test('UI denies IAM for ordinary admins and Super Admin missing required permissions',()=>{
 assert(canManageIam(full,'admins.read'));assert(canVisit(full,'/iam/admins'));assert(!canVisit({...full,isSuperAdmin:false},'/iam/admins'));assert(!canVisit({...full,permissions:[]},'/iam/roles'));assert(!canVisit(full,'/unknown-page'));assert(!hasPermissions({...full,status:'SUSPENDED'},'admins.read'));assert(!canManageIam(null,'roles.read'));assert.equal(firstAllowedPath(full),'/');assert.equal(firstAllowedPath({...full,isSuperAdmin:false,permissions:['arena.settings.read']}),'/arena/settings');assert.equal(firstAllowedPath({...full,isSuperAdmin:false,permissions:['settings.landing.read']}),'/settings/landing');
});
test('all current dashboard pages have a deliberate UI policy; create routes require write permissions',()=>{
 const base=path.resolve('apps/admin-web/app/[locale]/(dashboard)');let count=0;
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.name==='page.tsx'){const route='/'+path.relative(base,path.dirname(file)).split(path.sep).map(segment=>segment.startsWith('[')?'fixture':segment).filter(Boolean).join('/');assert(canVisit(full,route),'Unmapped page '+route);count++;}}}walk(base);assert(count>=40);
 assert(!canVisit({...full,permissions:['toeic.read']},'/assessment/create'));assert(!canVisit({...full,permissions:['dictation.read']},'/dictation/create'));
});
test('cached/coarse login profiles are not accepted as verified backend principals',()=>{
 assert.equal(verifiedAdminProfile(full),full);
 for(const invalid of [{role:'ADMIN'},{...full,authVersion:undefined},{...full,permissions:'*'},{...full,roleCodes:[true]},{...full,isSuperAdmin:undefined}])assert.throws(()=>verifiedAdminProfile(invalid));
});
test('Vietnamese/English IAM keys match and cover every catalogue resource/action',()=>{
 const vi=JSON.parse(fs.readFileSync('apps/admin-web/locales/vi/iam.json','utf8')),en=JSON.parse(fs.readFileSync('apps/admin-web/locales/en/iam.json','utf8'));
 const flatten=(obj,prefix='')=>Object.entries(obj).flatMap(([key,value])=>typeof value==='object'?flatten(value,prefix+key+'.'):[prefix+key]);assert.deepEqual(flatten(vi).sort(),flatten(en).sort());
 for(const p of PERMISSION_CATALOGUE){assert(vi.modules[p.code.split('.')[0]],p.code);assert(vi.actions[p.code.split('.').at(-1)],p.code);for(const resource of p.code.split('.').slice(1,-1))assert(vi.resources[resource],resource);}
});
