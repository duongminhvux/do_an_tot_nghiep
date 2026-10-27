/** Unit smoke for the SQL persistence adapter. Does not require a PostgreSQL server. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(require.resolve('typescript',{paths:[path.join(__dirname,'..','apps/api'),path.join(__dirname,'..'),'/opt/nvm/versions/node/v22.16.0/lib/node_modules']}));
const location=path.join(__dirname,'../apps/api/src/postgres/compat.ts');
const transpiled=ts.transpileModule(fs.readFileSync(location,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
class FakePool {
 constructor(){this.tables={users:[],gamedefinitions:[]};this.statements=[];}
 async query(sql,params=[]){
  this.statements.push({sql,params});
  if(sql.includes('information_schema.columns')){
   const table=params[0];
   const columns=table==='gamedefinitions'
     ? {id:'uuid',payload:'jsonb',code:'text',name:'text',destination:'text',category:'jsonb',badge:'jsonb',settings:'jsonb',order:'double precision',is_active:'boolean',created_at:'timestamp with time zone',updated_at:'timestamp with time zone'}
     : {id:'uuid',payload:'jsonb',email:'text',username:'text',password_hash:'text',is_deleted:'boolean',created_at:'timestamp with time zone',updated_at:'timestamp with time zone'};
   return {rows:Object.entries(columns).map(([column_name,data_type])=>({column_name,data_type}))};
  }
  if(sql.includes('AS group_key, COUNT(*)::integer AS count'))return {rows:[{group_key:'TYPING_RUSH',count:1}]};
  const counts=sql.match(/^SELECT COUNT\(\*\)::integer AS n FROM public\."([a-z_]+)"/);
  if(counts)return {rows:[{n:this.tables[counts[1]].length}]};
  const ids=sql.match(/^SELECT id FROM public\."([a-z_]+)"/);
  if(ids)return {rows:this.tables[ids[1]].slice(0,1)};
  const queryTable=sql.match(/^SELECT \* FROM public\."([a-z_]+)"/);
  if(queryTable)return {rows:[...this.tables[queryTable[1]]]};
  const insertTable=sql.match(/^INSERT INTO public\."([a-z_]+)"/);
  if(insertTable){
   const table=insertTable[1];
   const cs=sql.match(/\(([^)]+)\) VALUES/)?.[1].replace(/"/g,'').split(',');
   assert(cs,'insert columns should be extracted');
   const data=Object.fromEntries(cs.map((c,i)=>[c,params[i]]));
   for(const col of table==='gamedefinitions'?['payload','category','badge','settings']:['payload']){
     if(data[col]!==undefined && data[col]!==null)data[col]=JSON.parse(data[col]);
   }
   const idx=this.tables[table].findIndex(x=>x.id===data.id);
   const old=idx===-1?{}:this.tables[table][idx];
   const rec={...old,...data,created_at:old.created_at||new Date(),updated_at:new Date()};
   if(idx===-1)this.tables[table].push(rec);else this.tables[table][idx]=rec;
   return {rows:[rec]};
  }
  if(sql.startsWith('DELETE FROM public."users"')){
   this.tables.users=this.tables.users.filter(x=>x.id!==params[0]);return {rows:[]};
  }
  throw Error('Unexpected SQL in smoke test: '+sql);
 }
}
function noop(){return () => {};}
const nestStub={Injectable:noop,Inject:noop,Module:noop,Global:noop};
const mod={exports:{}};
let remoteFetch = async () => { throw new Error('Unexpected remote read'); };
const ownership={exports:{}};
const sessionStub={sessionPool:pool=>pool};
const publicationStub={publicationScope:{getStore:()=>undefined},PUBLICATION_TABLES:new Set(),visiblePublicationRows:(_table,rows)=>rows};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../apps/api/src/postgres/ownership.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {module:ownership,exports:ownership.exports,process,Buffer,Object},{filename:'ownership.ts'});
vm.runInNewContext(transpiled,{module:mod,exports:mod.exports,require(name){return name==='./ownership.js'?ownership.exports:name==='./session.js'?sessionStub:name==='../modules/publication/publication-scope.js'?publicationStub:name==='pg'?{default:FakePool,Pool:FakePool}:name==='@nestjs/common'?nestStub:require(name);},fetch:(...args)=>remoteFetch(...args),AbortSignal,process,console,Buffer,Date,Math,Promise,JSON,RegExp,Number,String,Object,Array,Map,Set,Symbol,Error,Boolean,Intl,setTimeout,clearTimeout},{filename:location});
const {makePgModel,PgId,PgField,PgSchemaFactory,sqlTable,runAggregation,simpleWhere,matches}=mod.exports;
(async()=>{
 const pool=new FakePool();
 const regexWhere=simpleWhere({username:{$regex:/^alice$/i}},new Map([['username','text']]));
 assert(regexWhere.sql.includes('~*'));
 assert.equal(regexWhere.values[0],'^alice$');
 assert(matches({username:'ALICE'},{username:{$regex:/^alice$/i}}));
 class User{};PgField({type:String,required:true})(User.prototype,'email');PgSchemaFactory.createForClass(User);
 const users=makePgModel('User',pool);
 const a=await users.create({email:'a@example.org',username:'alice',isDeleted:false});
 assert(PgId.isValid(String(a._id)));assert.equal(a.email,'a@example.org');
 assert.equal((await users.findOne({email:'a@example.org'})).username,'alice');
 assert.equal(await users.countDocuments({}),1);
 const forced=await users.findById(a.id).select('+username').exec();
 assert.equal(forced.email,'a@example.org');assert.equal(forced.username,'alice');
 const forcedAndExcluded=await users.findById(a.id).select('+username -email').exec();
 assert.equal(forcedAndExcluded.username,'alice');assert.equal(forcedAndExcluded.email,undefined);
 const restricted=await users.findById(a.id).select('email +username -_id').exec();
 assert.equal(restricted.email,'a@example.org');assert.equal(restricted.username,'alice');assert.equal(restricted._id,undefined);
 assert.equal((await users.findById(a.id).select({email:0})).email,undefined);
 assert.equal(await users.countDocuments({}).exec(),1);
 assert.equal(users.collection.name,'users');
 assert.equal((await users.find({}).collation({locale:'vi',numericOrdering:true}).sort({username:1}).exec()).length,1);
 const maybeUser=new users({username:'no-email'});
 await assert.rejects(()=>maybeUser.validate(),/User.email is required/);
 await a.validate();

 assert.equal((await users.updateOne({email:'a@example.org'},{$set:{username:'bobby'},$inc:{loginCount:1}}).exec()).modifiedCount,1);
 assert.equal((await users.findById(a.id)).username,'bobby');
 assert.equal((await users.findOne({email:{$in:['a@example.org']}})).loginCount,1);
 assert.equal((await users.find({}).lean().sort('-createdAt').limit(10)).length,1);
 assert(pool.statements.some(s=>/ORDER BY \"created_at\" DESC NULLS LAST/.test(s.sql)&&/ LIMIT \$\d+/.test(s.sql)), 'find().sort().limit() must paginate in SQL');
 await users.find({isDeleted:{$ne:true}}).sort({createdAt:-1}).skip(5).limit(10).exec();
 assert(pool.statements.some(s=>/ORDER BY \"created_at\" DESC/.test(s.sql)&&/ OFFSET \$\d+/.test(s.sql)), 'find().skip() must use SQL OFFSET');
 await users.find({isDeleted:{$in:[false]}}).limit(5).exec();
 assert(pool.statements.some(s=>/\"is_deleted\" IN \(\$\d+\)/.test(s.sql)), 'native boolean IN must not cast to text');
 assert.equal(await users.countDocuments({isDeleted:false}),1);
 assert.equal((await users.updateMany({isDeleted:false},{$set:{active:true}}).exec()).modifiedCount,1);
 assert.equal((await users.distinct('email').exec()).length,1);
 assert.equal((await users.distinct('email')).length,1);
 assert.equal((await users.aggregate([{$match:{username:'bobby'}},{$count:'total'}]))[0].total,1);
 assert.equal((await users.deleteOne({_id:a.id}).exec()).deletedCount,1);
 assert.equal(await users.countDocuments({}),0);
 assert.equal(sqlTable('User'),'users');
 // Regression: a PostgreSQL JSONB enum cannot receive the bare SQL parameter SOLO.
 // In the V8.1 adapter, this upsert threw PostgreSQL error 22P02 at boot time.
 const games=makePgModel('GameDefinition',pool);
 const inserted=await games.updateOne({code:'TYPING_RUSH'},{$set:{destination:'/games/typing-rush'},
   $setOnInsert:{code:'TYPING_RUSH',name:'Typing Rush',category:'SOLO',badge:'FEATURED',
     settings:{lives:3},order:0,isActive:true}},{upsert:true}).exec();
 assert.equal(inserted.upsertedCount,1);
 assert.equal(pool.tables.gamedefinitions[0].category,'SOLO');
 assert.equal(pool.tables.gamedefinitions[0].badge,'FEATURED');
 assert.deepEqual(pool.tables.gamedefinitions[0].settings,{lives:3});
 assert.equal(pool.tables.gamedefinitions[0].code,'TYPING_RUSH');
 assert.equal(pool.tables.gamedefinitions[0].destination,'/games/typing-rush');
 await games.updateOne({code:'TYPING_RUSH'},{$set:{category:'MULTIPLAYER',badge:null}}).exec();
 assert.equal(pool.tables.gamedefinitions[0].category,'MULTIPLAYER');
 assert.equal(pool.tables.gamedefinitions[0].badge,null);
 const fastGrouped=await games.aggregate([{$match:{code:'TYPING_RUSH'}},{$group:{_id:'$code',count:{$sum:1}}}]);
 assert.equal(fastGrouped[0].count,1);
 assert(pool.statements.some(x=>x.sql.includes('GROUP BY \"code\"')), 'simple group count should run in PostgreSQL');
 const ranked=await runAggregation([
   {$setWindowFields:{sortBy:{rating:-1},output:{position:{$rank:{}}}}},
 ],[{rating:800},{rating:1000},{rating:1000},{rating:700}]);
 assert.deepEqual(Array.from(ranked,row=>row.position),[1,1,3,4]);
 const days=await runAggregation([
   {$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$occurredAt',timezone:'Asia/Saigon'}},xp:{$sum:'$xp'}}},
 ],[{occurredAt:'2026-10-23T18:00:00Z',xp:10},{occurredAt:'2026-10-24T01:00:00Z',xp:20}]);
 assert.equal(days.length,1);assert.equal(days[0]._id,'2026-10-24');assert.equal(days[0].xp,30);
 const scores=await runAggregation([
   {$match:{score:{$type:'number'}}},{$group:{_id:null,avg:{$avg:'$score'}}},
 ],[{score:500},{score:700},{score:null},{score:'900'}]);
 assert.equal(scores[0].avg,600);
 const fixtureGroupA=String(new PgId()),fixtureGroupB=String(new PgId());
 pool.tables.exams=[{id:String(new PgId()),group_id:fixtureGroupA,is_deleted:false,payload:{}},{id:String(new PgId()),group_id:fixtureGroupB,is_deleted:true,payload:{}}];
 const groupCounts=await runAggregation([
   {$lookup:{from:'exams',let:{groupId:'$_id'},pipeline:[{$match:{$expr:{$eq:['$groupId','$$groupId']},isDeleted:{$ne:true}}},{$count:'count'}],as:'counts'}},
   {$addFields:{examCount:{$ifNull:[{$arrayElemAt:['$counts.count',0]},0]}}},{$project:{counts:0}},
 ],[{_id:fixtureGroupA,name:'first'},{_id:fixtureGroupB,name:'second'}],pool);
 assert.equal(groupCounts[0]._id,fixtureGroupA);assert.equal(groupCounts[0].name,'first');assert.equal(groupCounts[0].examCount,1);
 assert.equal(groupCounts[1].examCount,0);assert(!('counts' in groupCounts[0]));
 const previousRole=process.env.SERVICE_ROLE, previousToken=process.env.INTERNAL_SERVICE_TOKEN;
 try {
   process.env.SERVICE_ROLE='identity';process.env.INTERNAL_SERVICE_TOKEN='smoke-internal-token-with-24-characters';
   let requests=0;
   const userId=String(a._id);
   remoteFetch=async(url,options)=>{
     requests++;
     assert(url.startsWith('http://learning-service:5000/api/_internal/read-models/userlessonwords'));
     assert.equal(options.headers['x-internal-token'],process.env.INTERNAL_SERVICE_TOKEN);
     if(url.endsWith('/count'))return {ok:true,json:async()=>({statusCode:200,data:{count:1}})};
     return {ok:true,json:async()=>({data:[{id:String(new PgId()),user_id:userId,payload:{},created_at:new Date()}]})};
   };
   const foreign=makePgModel('UserLessonWord',pool);
   assert.equal(await foreign.countDocuments({userId}),1);
   assert.equal((await foreign.find({userId}).limit(1).exec()).length,1);
   assert.equal((await foreign.aggregate([{$group:{_id:'$userId',count:{$sum:1}}}]))[0].count,1);
   await assert.rejects(()=>foreign.create({userId}),/cannot write learning.userlessonwords/);
   await assert.rejects(()=>foreign.updateOne({},{$set:{status:'done'}}).exec(),/cannot write/);
   assert.equal(requests,3,'Cross-service writes must fail before any read');
   remoteFetch=async()=>({ok:false,status:503});
   await assert.rejects(()=>foreign.find().exec(),/unavailable \(503\)/);
 } finally {
   if(previousRole===undefined)delete process.env.SERVICE_ROLE;else process.env.SERVICE_ROLE=previousRole;
   if(previousToken===undefined)delete process.env.INTERNAL_SERVICE_TOKEN;else process.env.INTERNAL_SERVICE_TOKEN=previousToken;
 }
 console.log('POSTGRES ADAPTER SMOKE: CRUD/filter/aggregate, JSONB, remote ownership checks passed (mock pool only)');
})().catch(err=>{console.error(err);process.exitCode=1});
