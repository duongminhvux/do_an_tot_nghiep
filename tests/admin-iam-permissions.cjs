const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module'),req=createRequire(path.resolve('apps/api/package.json'));req('reflect-metadata');
const {Reflector}=req('@nestjs/core'),{Controller,Get}=req('@nestjs/common');
const load=require('./helpers/load-typescript.cjs'),{routes}=require('./admin-iam-policy-coverage.cjs');
const {PermissionsGuard}=load('apps/api/src/modules/auth/guards/permissions.guard.ts');
const {AdminController}=load('apps/api/src/modules/auth/decorators/admin-controller.decorator.ts');
const {PERMISSION_CATALOGUE}=load('apps/api/src/modules/admins/permission-catalogue.ts');
const full={role:'ADMIN',status:'ACTIVE',authVersion:1,isSuperAdmin:true,permissions:PERMISSION_CATALOGUE.map(p=>p.code)};
const guard=new PermissionsGuard(new Reflector());
function context(route,user,body={}){return {getType:()=> 'http',getClass:()=>route.controller,getHandler:()=>route.handler,switchToHttp:()=>({getRequest:()=>({user,body,path:route.url,headers:{'x-permissions':JSON.stringify(full.permissions)}})})};}
const status=n=>error=>error.getStatus?.()===n;
test('all 235 reviewed route policies allow the intended audience and deny missing rights',()=>{
 assert.equal(routes.length,235);
 for(const r of routes){
  if(['E1','E2','E3','E6'].includes(r.exemption)){assert.equal(guard.canActivate(context(r,undefined)),true);continue;}
  if(r.exemption==='E5'){assert.equal(guard.canActivate(context(r,{role:'USER'})),true);assert.throws(()=>guard.canActivate(context(r,full)),status(403));continue;}
  if(r.condition==='C3'){assert.equal(guard.canActivate(context(r,{role:'USER'})),true);continue;}
  assert.equal(guard.canActivate(context(r,full)),true,r.method+' '+r.url);
  if(r.exemption==='E4'){assert.throws(()=>guard.canActivate(context(r,{role:'USER'})),status(403));continue;}
  for(const code of r.permissions){assert.throws(()=>guard.canActivate(context(r,{...full,permissions:full.permissions.filter(p=>p!==code)})),status(403),r.url+' missing '+code);}
  if(r.condition==='C4')assert.equal(guard.canActivate(context(r,{role:'USER'})),true);
  else assert.throws(()=>guard.canActivate(context(r,{role:'USER'})),status(403));
 }
});
test('C1 requires users.lock through status payload aliases, independently of users.update/create',()=>{
 for(const r of routes.filter(r=>r.condition==='C1')){
  const admin={...full,permissions:full.permissions.filter(p=>p!=='users.lock')};
  assert.equal(guard.canActivate(context(r,admin,{})),true);
  assert.throws(()=>guard.canActivate(context(r,admin,{status:'banned'})),status(403));
  if(r.name==='update')assert.throws(()=>guard.canActivate(context(r,admin,{status:'active'})),status(403));
 }
});
test('new administrative route without policy fails closed, including SUPER_ADMIN and forged client permissions',()=>{
 class UnknownController {unmapped(){return true;}}
 AdminController('unmapped-test')(UnknownController);Get('new')(UnknownController.prototype,'unmapped',Object.getOwnPropertyDescriptor(UnknownController.prototype,'unmapped'));
 const r={controller:UnknownController,handler:UnknownController.prototype.unmapped,url:'/api/admin/unmapped-test/new'};
 assert.throws(()=>guard.canActivate(context(r,full,{permissions:full.permissions})),status(403));
 class PlainAdmin {unknown(){}}
 Controller('admin/plain-test')(PlainAdmin);
 assert.throws(()=>guard.canActivate(context({...r,controller:PlainAdmin,handler:PlainAdmin.prototype.unknown},full)),status(403));
});
test('comment moderation uses current permission, not the ADMIN role literal',()=>{
 const {ExamCommunityController}=load('apps/api/src/modules/assessment/exams/community/exam-community.controller.ts');
 const passed=[];const controller=new ExamCommunityController({remove:(...args)=>passed.push(args.at(-1))});
 controller.remove('exam','comment',{user:{_id:'actor',role:'ADMIN',permissions:[]}});
 controller.remove('exam','comment',{user:{_id:'actor',role:'USER',permissions:['toeic.comments.moderate']}});
 controller.remove('exam','comment',{user:{_id:'actor',role:'ADMIN',permissions:['toeic.comments.moderate']}});
 assert.deepEqual(passed,[false,false,true]);
});

test('production AuthModule installs JWT before global permission enforcement',()=>{
 const {AuthModule}=load('apps/api/src/modules/auth/auth.module.ts');
 const {APP_GUARD}=req('@nestjs/core');
 const {JwtAuthGuard}=load('apps/api/src/modules/auth/guards/jwt-auth.guard.ts');
 const guards=Reflect.getMetadata('providers',AuthModule).filter(p=>p.provide===APP_GUARD).map(p=>p.useClass);
 assert.deepEqual(guards,[JwtAuthGuard,PermissionsGuard]);
});
