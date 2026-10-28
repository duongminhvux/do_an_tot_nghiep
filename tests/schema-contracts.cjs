/** Compare plain row contracts with the effective migrated PostgreSQL schema. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {nativePostgres}=require('./helpers/native-postgres.cjs');
const spec=require('../database/postgres/schema-spec.json'),interfaces=new Map(),failures=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.row.ts')){
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  for(const node of source.statements)if(ts.isInterfaceDeclaration(node))interfaces.set(node.name.text,{node,source});
}}}walk(path.join(__dirname,'../apps/api/src'));
const overrides={LearningActivity:'learning_activities',SavedWord:'usersavedwords'};
(async()=>{
  let checked=0;
  for(const [domain,definition]of Object.entries(spec.domains)){
    const test=await nativePostgres([domain==='media'?'media-jobs':domain==='ai_import'?'ai-import':domain]);
    try{
      for(const [name,{node,source}]of interfaces){
        const base=name.toLowerCase(),table=[overrides[name],base,base+'s',base+'es',base.endsWith('y')?base.slice(0,-1)+'ies':null].find(key=>definition.tables[key]);if(!table)continue;
        checked++;const fields=new Map(node.members.filter(ts.isPropertySignature).map(member=>[member.name.getText(source).replace(/['"]/g,'').replace(/([a-z\d])([A-Z])/g,'$1_$2').toLowerCase(),member]));
        const {rows}=await test.connection.query('SELECT column_name,is_nullable,column_default,data_type FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1',[table]);
        const columns=new Set(rows.map(column=>column.column_name));
        for(const field of fields.keys())if(!columns.has(field==='password'?'password_hash':field))failures.push(`${table}.${field} is a business row field without a SQL column`);
        for(const column of rows){if(['id','payload','created_at','updated_at'].includes(column.column_name))continue;
          const field=fields.get(column.column_name==='password_hash'?'password':column.column_name);
          if(column.is_nullable==='NO'&&!column.column_default&&!field)failures.push(`${table}.${column.column_name} required but absent from ${name}`);
          if(field?.type&&ts.isArrayTypeNode(field.type)&&!['json','jsonb','text','ARRAY'].includes(column.data_type))failures.push(`${table}.${column.column_name} array stored as ${column.data_type}`);
        }
      }
    }finally{await test.close();}
  }
  assert(checked>=35,'Must check actual root row contracts');assert.deepEqual(failures,[]);console.log(`PASS: ${checked} native row contracts match migrated SQL columns`);
})().catch(error=>{console.error(error);process.exitCode=1;});
