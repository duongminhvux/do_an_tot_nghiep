const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {nativePostgres,source}=require('./helpers/native-postgres.cjs');
const {readContentRows}=source('modules/vocabulary/content-reader.ts');
const {readAssessmentRows}=source('modules/assessment/assessment-reader.ts');
const {readLearningFeed}=source('modules/learning/learning-reader.ts');
const {authorizeInternal}=source('internal/authorize.ts');
(async()=>{
 const test=await nativePostgres(['content']),oldRole=process.env.SERVICE_ROLE,oldToken=process.env.INTERNAL_SERVICE_TOKEN;
 try{
  const db=test.connection,id=randomUUID();process.env.SERVICE_ROLE='content';process.env.INTERNAL_SERVICE_TOKEN='native-owner-test-authenticated-token';
  assert.throws(()=>authorizeInternal('wrong',['content']));assert.throws(()=>authorizeInternal(process.env.INTERNAL_SERVICE_TOKEN,['assessment']));authorizeInternal(process.env.INTERNAL_SERVICE_TOKEN,['content']);
  for(const input of [{ids:['bad']},{ids:Array(2001).fill(id)},{limit:2001},{offset:-1}]){
    await assert.rejects(()=>readContentRows(db,'words',input));
  }
  await assert.rejects(()=>readAssessmentRows(db,'attempts',{ids:[id]}));
  await assert.rejects(()=>readLearningFeed(db,{userId:'bad',limit:5}));
  const before=test.statements.length;await readContentRows(db,'words',{search:"' OR TRUE --",limit:10});
  const statement=test.statements[before];assert(!statement.text.includes("' OR TRUE --"));assert(statement.params.includes("' OR TRUE --"));
  await db.query("INSERT INTO words(word,slug,level,parts) VALUES('100% native','percent-native','A1','[]'),('native plain','plain-native','A1','[]')");
  assert.equal((await readContentRows(db,'words',{search:'%',limit:10})).length,1,'Search treats percent as literal text');
  console.log('PASS: owner authentication, role boundaries, scoped reads, bounded IDs/pages and SQL parameterization');
 }finally{if(oldRole===undefined)delete process.env.SERVICE_ROLE;else process.env.SERVICE_ROLE=oldRole;if(oldToken===undefined)delete process.env.INTERNAL_SERVICE_TOKEN;else process.env.INTERNAL_SERVICE_TOKEN=oldToken;await test.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
