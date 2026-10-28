/** Read-model controller contract without Nest bootstrap or PostgreSQL. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(require.resolve('typescript',{paths:[path.join(__dirname,'..','apps/api'),path.join(__dirname,'..')]}));
const root=path.resolve(__dirname,'..');
const {randomUUID}=require('node:crypto');
function transpile(relative){const file=path.join(root,relative);return ts.transpileModule(fs.readFileSync(file,'utf8'),
  {fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText;}
const ownership={exports:{}};
vm.runInNewContext(transpile('apps/api/src/postgres/ownership.ts'),{module:ownership,exports:ownership.exports,process,Object});
const pgCompat={exports:{}};
const stub={sessionPool:p=>p};
const publication={publicationScope:{getStore:()=>undefined},PUBLICATION_TABLES:new Set(),visiblePublicationRows:(_table,rows)=>rows};
const emptyDecorator=()=>()=>{};
class HttpError extends Error{constructor(message){super(message);this.status=this.constructor.name;}}
class BadRequestException extends HttpError{};
class ForbiddenException extends HttpError{};
class UnprocessableEntityException extends HttpError{};
const nest={BadRequestException,ForbiddenException,UnprocessableEntityException,
  Controller:emptyDecorator,Get:emptyDecorator,Post:emptyDecorator,Headers:emptyDecorator,Param:emptyDecorator,
  Body:emptyDecorator,HttpCode:emptyDecorator,Inject:emptyDecorator,Injectable:emptyDecorator,
  Global:emptyDecorator,Module:emptyDecorator};
vm.runInNewContext(transpile('apps/api/src/postgres/compat.ts'),{
 module:pgCompat,exports:pgCompat.exports,process,Buffer,Date,RegExp,Intl,Map,Set,AbortSignal,
 require(id){if(id==='./connection.js')return require('./helpers/load-typescript.cjs')(path.join(__dirname,'../apps/api/src/postgres/connection.ts'));if(id==='pg')return {default:{}};if(id==='@nestjs/common')return nest;
  if(id==='./session.js')return stub;if(id==='./ownership.js')return ownership.exports;
  if(id==='../modules/publication/publication-scope.js')return publication;
  return require(id);}
},{filename:'compat.ts'});
const output={exports:{}};
vm.runInNewContext(transpile('apps/api/src/internal/read-models.module.ts'),{
 module:output,exports:output.exports,process,Buffer,
 require(id){
  if(id==='@nestjs/common')return nest;
  if(id==='../postgres/compat.js')return pgCompat.exports;
  if(id==='../postgres/ownership.js')return ownership.exports;
  if(id==='../modules/auth/decorators/public.decorator.js')return {Public:emptyDecorator};
  if(id.endsWith('.controller.js'))return new Proxy({}, {get:()=>class Controller {}});
  return require(id);
 }
},{filename:'read-models.module.ts'});
const {ReadModelsController}=output.exports;
const previousToken=process.env.INTERNAL_SERVICE_TOKEN,previousRole=process.env.SERVICE_ROLE;
process.env.INTERNAL_SERVICE_TOKEN='test-internal-token-at-least-24-chars';
process.env.SERVICE_ROLE='identity';
const queries=[];
const id=randomUUID();
const pool={query:async(sql,params=[])=>{
 queries.push({sql,params});
 if(sql.includes('information_schema.columns'))return {rows:[
  {column_name:'id',data_type:'uuid'},
  {column_name:'username',data_type:'text'},
  {column_name:'password_hash',data_type:'text'},
  {column_name:'is_deleted',data_type:'boolean'},
  {column_name:'is_banned',data_type:'boolean'},
  {column_name:'created_at',data_type:'timestamp with time zone'},
  {column_name:'updated_at',data_type:'timestamp with time zone'}]};
 if(sql.includes('COUNT(*)'))return {rows:[{count:1}]};
 return {rows:[{id,username:'student',password_hash:'secret',is_deleted:false,
  is_banned:false,payload:{password:'secret'},created_at:new Date()}]};
}};
(async()=>{
 const ctl=new ReadModelsController(pool);
 await assert.rejects(()=>ctl.rows('wrong-token','users'),ForbiddenException);
 await assert.rejects(()=>ctl.query('wrong-token','users',{filter:{},offset:0,limit:1}),ForbiddenException);
 await assert.rejects(()=>ctl.query(process.env.INTERNAL_SERVICE_TOKEN,'admins',{filter:{},limit:10}),BadRequestException);
 const list=await ctl.query(process.env.INTERNAL_SERVICE_TOKEN,'users',{
  filter:{isDeleted:{$ne:true},_id:{$in:[id]}},sort:{createdAt:-1},offset:2,limit:10});
 assert.equal(list.length,1);
 assert.equal(list[0].username,'student');
 assert(!('password_hash' in list[0]));
 assert(!('password' in list[0].payload));
 const last=queries.at(-1);
 assert(last.sql.includes('ORDER BY "created_at" DESC NULLS LAST, id ASC'));
 assert(last.sql.includes('LIMIT $'));
 assert(!last.sql.includes('secret'));
 assert.equal(last.params.at(-2),10);assert.equal(last.params.at(-1),2);
 assert(last.sql.includes('"id" IN ('));
 assert(!last.sql.includes('::text'), 'UUID predicates must use native indexable UUID');
 const count=await ctl.count(process.env.INTERNAL_SERVICE_TOKEN,'users',{filter:{isDeleted:false}});
 assert.equal(count.count,1);
 assert(queries.at(-1).sql.includes('COUNT(*)'));
 await assert.rejects(()=>ctl.query(process.env.INTERNAL_SERVICE_TOKEN,'users',{filter:{passwordHash:'unknown'},limit:5}),UnprocessableEntityException);
 await assert.rejects(()=>ctl.count(process.env.INTERNAL_SERVICE_TOKEN,'users',{filter:{payload:{password:'x'}}}),UnprocessableEntityException);
 await assert.rejects(()=>ctl.query(process.env.INTERNAL_SERVICE_TOKEN,'users',{filter:{},limit:4000}),UnprocessableEntityException);
 const old=await ctl.rows(process.env.INTERNAL_SERVICE_TOKEN,'users');
 assert.equal(old.length,1);assert(!('password_hash' in old[0]));
 assert(!queries.at(-1).sql.includes('SELECT * FROM public."users"'));
 console.log('INTERNAL READ-MODEL CONTRACT PASS: filtered SQL, count, bounded page, token, private data');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
 if(previousToken===undefined)delete process.env.INTERNAL_SERVICE_TOKEN;else process.env.INTERNAL_SERVICE_TOKEN=previousToken;
 if(previousRole===undefined)delete process.env.SERVICE_ROLE;else process.env.SERVICE_ROLE=previousRole;
});
