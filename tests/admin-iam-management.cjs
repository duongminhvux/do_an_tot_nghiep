const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module'),req=createRequire(path.resolve('apps/api/package.json'));req('reflect-metadata');
const load=require('./helpers/load-typescript.cjs');
const controllers=load('apps/api/src/modules/admins/admin-management.controller.ts');
const validation=load('apps/api/src/modules/admins/admin-iam.validation.ts');
const {PermissionsGuard}=load('apps/api/src/modules/auth/guards/permissions.guard.ts');
const {PERMISSIONS_KEY}=load('apps/api/src/modules/auth/decorators/require-permissions.decorator.ts');
const {METHOD_METADATA}=req('@nestjs/common/constants'),{Reflector}=req('@nestjs/core');
const status=n=>error=>error.getStatus?.()===n;

test('every new IAM handler is explicitly guarded; SUPER_ADMIN cannot bypass a missing permission',()=>{
 const guard=new PermissionsGuard(new Reflector());let count=0;
 for(const controller of Object.values(controllers))for(const name of Object.getOwnPropertyNames(controller.prototype)){
  const handler=controller.prototype[name];if(!Reflect.hasMetadata(METHOD_METADATA,handler))continue;count++;
  const codes=Reflect.getMetadata(PERMISSIONS_KEY,handler);assert.equal(codes.length,1);
  const full={role:'ADMIN',status:'ACTIVE',authVersion:1,isSuperAdmin:true,permissions:codes};
  const context=user=>({getType:()=> 'http',getClass:()=>controller,getHandler:()=>handler,switchToHttp:()=>({getRequest:()=>({user,path:'/api/admin/iam'})})});
  assert.equal(guard.canActivate(context(full)),true);
  assert.throws(()=>guard.canActivate(context({...full,permissions:[]})),status(403));
  assert.throws(()=>guard.canActivate(context({role:'USER',permissions:codes})),status(403));
 }assert.equal(count,12);
});
test('IAM input parser rejects mass assignment, malformed identities and pagination rather than coercing them',()=>{
 for(const input of [null,[],true,'text'])assert.throws(()=>validation.iamObject(input,['email']),status(400));
 assert.throws(()=>validation.iamObject({email:'x',isSuperAdmin:true},['email']),status(400));
 for(const input of ['invalid','name space','foo@bar'])assert.throws(()=>validation.iamUsername(input==='invalid'?'':input),status(400));
 assert.throws(()=>validation.iamEmail('bad-email'),status(400));assert.equal(validation.iamEmail(' PERSON@Example.test '),'person@example.test');
 for(const input of [0,'0','-1','1.5',[],{},'101'])assert.throws(()=>validation.iamPage(input,20,100),status(400));
 for(const input of ['javascript:alert(1)','http://example.test/a'])assert.throws(()=>validation.iamAvatar(input),status(400));
 assert.throws(()=>validation.iamIds(['not-a-uuid']),status(400));assert.throws(()=>validation.iamIds('id'),status(400));
 assert.throws(()=>validation.iamText('x'.repeat(201),'name',200),status(400));
});
test('controllers forward only the authenticated principal, never a body actor',()=>{
 const actor={_id:'trusted'},body={email:'new@example.test',actor:{_id:'forged'}};let args;
 const controller=new controllers.AdminAccountsController({createAdmin:(...input)=>{args=input;}});
 controller.create({user:actor},body);assert.equal(args[0],actor);assert.equal(args[1],body);
 // The service allowlist rejects the actor field before any SQL.
 const {AdminManagementService}=load('apps/api/src/modules/admins/admin-management.service.ts');
 return assert.rejects(()=>new AdminManagementService({runIamTransaction:()=>{throw Error('SQL must not run');}}).createAdmin(actor,body),status(400));
});
