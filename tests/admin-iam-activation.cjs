const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module'),req=createRequire(path.resolve('apps/api/package.json'));req('reflect-metadata');
const load=require('./helpers/load-typescript.cjs');
const {AdminActivationService}=load('apps/api/src/modules/admins/admin-activation.service.ts');
const {ActivationRateLimiter,AdminActivationController,AdminReinviteController}=load('apps/api/src/modules/admins/admin-activation.controller.ts');
const {PermissionsGuard}=load('apps/api/src/modules/auth/guards/permissions.guard.ts'),{Reflector}=req('@nestjs/core');
const {PERMISSIONS_KEY,EXEMPTION_KEY}=load('apps/api/src/modules/auth/decorators/require-permissions.decorator.ts');
const status=n=>error=>error.getStatus?.()===n;
test('activation token derivation is purpose/admin/record bound and only usable with configured secret',()=>{
 const values={ADMIN_ACTIVATION_TOKEN_KEY:'a'.repeat(64)};const service=new AdminActivationService({}, {get:k=>values[k]}, {}, {});
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const raw=service.raw(id,other);assert.match(raw,/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);assert.equal(raw,service.raw(id,other));assert.notEqual(raw,service.raw(other,id));assert.equal(service.matches(raw,service.hash(raw)),true);
 values.ADMIN_ACTIVATION_TOKEN_KEY='b'.repeat(64);assert.notEqual(raw,service.raw(id,other));values.ADMIN_ACTIVATION_TOKEN_KEY='';assert.throws(()=>service.raw(id,other),status(503));
});
test('activation public exemption is explicit and reinvite cannot bypass permissions',()=>{
 const guard=new PermissionsGuard(new Reflector());
 for(const name of ['status','activate'])assert.equal(Reflect.getMetadata(EXEMPTION_KEY,AdminActivationController.prototype[name]),'E7');
 const handler=AdminReinviteController.prototype.reinvite;assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY,handler),['admins.reinvite']);
 const ctx=user=>({getType:()=> 'http',getClass:()=>AdminReinviteController,getHandler:()=>handler,switchToHttp:()=>({getRequest:()=>({user,path:'/api/admin/admins/id/reinvite'})})});
 assert.throws(()=>guard.canActivate(ctx({role:'USER'})),status(403));assert.throws(()=>guard.canActivate(ctx({role:'ADMIN',status:'ACTIVE',authVersion:1,isSuperAdmin:true,permissions:[]})),status(403));
});
test('public brute-force limiter is bounded and rejects excess calls',()=>{
 const limiter=new ActivationRateLimiter();for(let i=0;i<20;i++)limiter.check('test-ip','activate');assert.throws(()=>limiter.check('test-ip','activate'),status(429));limiter.check('other-ip','activate');
});
test('invalid admin web configuration never emits a localhost fallback link',()=>{
 for(const value of ['', 'http://localhost:3001','https://user:secret@example.test','https://example.test/?x=1']){
  const service=new AdminActivationService({}, {get:k=>k==='ADMIN_WEB_URL'?value:''}, {}, {});assert.throws(()=>service.urls(),status(503));
 }
});
