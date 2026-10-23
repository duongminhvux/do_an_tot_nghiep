import test from 'node:test';
import assert from 'node:assert/strict';
import {isEnabled,parseSeedOptions,seedAdminSql} from './seed-admin-core.mjs';
const hash=async(password)=>`bcrypt-hash:${password}`;
const env={DEFAULT_ADMIN_EMAIL:'ADMIN@gmail.com',DEFAULT_ADMIN_USERNAME:'admin',DEFAULT_ADMIN_PASSWORD:'admin',ADMIN_SEED_ALLOW_WEAK_PASSWORD:'true'};
function fakePg(initial=[]){
 const data=initial.map(x=>({...x}));
 return {data,async query(sql,params=[]){
   if(sql.startsWith('SELECT * FROM public.admins'))return {rows:data.filter(x=>x.email===params[0]||x.username===params[1])};
   if(sql.startsWith('INSERT INTO public.admins')){
     data.push({id:`id-${data.length+1}`,email:params[0],username:params[1],password_hash:params[2],is_deleted:false,payload:JSON.parse(params[3])});return {rowCount:1};
   }
   if(sql.startsWith('UPDATE public.admins')){
     const target=data.find(x=>x.id===params[0]);assert(target);target.password_hash=params[1];target.is_deleted=params[2];target.deleted_at=params[3];return {rowCount:1};
   }
   throw Error('Unexpected SQL: '+sql);
 }};
}
test('admin seed boolean settings and lower-case email',()=>{
 assert.equal(isEnabled('true'),true);assert.equal(isEnabled('FALSE'),false);
 const o=parseSeedOptions([],env);assert.equal(o.email,'admin@gmail.com');assert.equal(o.username,'admin');
});
test('first install creates bcrypt-compatible hashed admin',async()=>{
 const pg=fakePg();const result=await seedAdminSql(pg,parseSeedOptions([],env),hash);
 assert.equal(result.status,'created');assert.equal(pg.data[0].password_hash,'bcrypt-hash:admin');
 assert.equal(pg.data[0].is_deleted,false);
});
test('redeploy does not reset changed password',async()=>{
 const pg=fakePg([{id:'a',email:'admin@gmail.com',username:'admin',password_hash:'changed',is_deleted:false}]);
 const result=await seedAdminSql(pg,parseSeedOptions([],env),hash);
 assert.equal(result.status,'existing');assert.equal(pg.data[0].password_hash,'changed');
});
test('explicit password reset updates existing admin',async()=>{
 const pg=fakePg([{id:'a',email:'admin@gmail.com',username:'admin',password_hash:'changed',is_deleted:false}]);
 const result=await seedAdminSql(pg,parseSeedOptions(['--reset-password'],env),hash);
 assert.equal(result.status,'updated');assert.equal(pg.data[0].password_hash,'bcrypt-hash:admin');
});
test('weak passwords require a development-only flag',async()=>{
 const pg=fakePg();
 await assert.rejects(seedAdminSql(pg,parseSeedOptions([],{...env,ADMIN_SEED_ALLOW_WEAK_PASSWORD:'false'}),hash),/at least 12/);
 assert.equal(pg.data.length,0);
});
test('duplicate email / username conflict is refused',async()=>{
 const pg=fakePg([{id:'1',email:'admin@gmail.com',username:'other'},{id:'2',email:'other@gmail.com',username:'admin'}]);
 await assert.rejects(seedAdminSql(pg,parseSeedOptions([],env),hash),/different admin accounts/);
});
test('deleted admin only reactivates explicitly without password change',async()=>{
 const pg=fakePg([{id:'a',email:'admin@gmail.com',username:'admin',password_hash:'changed',is_deleted:true,deleted_at:new Date()}]);
 const unchanged=await seedAdminSql(pg,parseSeedOptions([],env),hash);
 assert.equal(unchanged.status,'existing-disabled');assert.equal(pg.data[0].is_deleted,true);
 const changed=await seedAdminSql(pg,parseSeedOptions(['--reactivate'],env),hash);
 assert.equal(changed.status,'updated');assert.equal(pg.data[0].is_deleted,false);
 assert.equal(pg.data[0].password_hash,'changed');
});
test('empty password only allowed for an already existing admin with no reset',async()=>{
 const options=parseSeedOptions([],{DEFAULT_ADMIN_EMAIL:'admin@gmail.com',DEFAULT_ADMIN_USERNAME:'admin'});
 await assert.rejects(seedAdminSql(fakePg(),options,hash),/Admin password/);
 const pg=fakePg([{id:'a',email:'admin@gmail.com',username:'admin',password_hash:'safe',is_deleted:false}]);
 const result=await seedAdminSql(pg,options,hash);assert.equal(result.status,'existing');
});
