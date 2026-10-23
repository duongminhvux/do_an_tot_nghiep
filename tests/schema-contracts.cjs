/** Reject SQL requirements accidentally copied from embedded schema classes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const ts=require(require.resolve('typescript',{paths:[path.join(root,'apps/api')]}));
const schema=JSON.parse(fs.readFileSync(path.join(root,'database/postgres/schema-spec.json'),'utf8'));
const tables=Object.assign({},...Object.values(schema.domains).map(domain=>domain.tables));
const overrides={LearningActivity:'learning_activities',SavedWord:'usersavedwords',GeneratedAudio:'media_assets',GameDefinition:'gamedefinitions',AudioJob:'audio_jobs',AsrJob:'asr_jobs',SystemSetting:'system_settings',PdfAiCorrectionEvent:'pdf_ai_correction_events'};
const failures=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory()){walk(file);continue;}if(!file.endsWith('.ts')||file.endsWith('.spec.ts'))continue;
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 for(const node of source.statements){if(!ts.isClassDeclaration(node)||!node.name)continue;
  const name=node.name.text,base=name.toLowerCase(),table=[overrides[name],base,base+'s',base+'es',base.endsWith('y')?base.slice(0,-1)+'ies':null].find(t=>t&&tables[t]);
  if(!table||name==='PdfAiCorrectionEvent')continue; // Assessment outbox and AI processing have separate SQL contracts.
  const fields=new Set(node.members.filter(ts.isPropertyDeclaration).map(member=>member.name.getText(source).replace(/['"]/g,'').replace(/([a-z\d])([A-Z])/g,'$1_$2').toLowerCase()));
  for(const [column,definition] of Object.entries(tables[table].fields))if(definition.required&&!fields.has(column)&&!(column==='password_hash'&&fields.has('password')))failures.push(`${table}.${column} is required but absent from ${name}`);
  for(const member of node.members.filter(ts.isPropertyDeclaration))if(member.type&&ts.isArrayTypeNode(member.type)){
    const column=member.name.getText(source).replace(/['"]/g,'').replace(/([a-z\d])([A-Z])/g,'$1_$2').toLowerCase();
    const definition=tables[table].fields[column];
    if(definition&&['double_precision','integer','uuid','boolean'].includes(definition.type))failures.push(`${table}.${column} is an array in ${name} but a scalar ${definition.type} in SQL`);
  }
 }
}}
walk(path.join(root,'apps/api/src/modules'));
assert.deepEqual(failures,[],'Required SQL columns must be parent entity fields: '+failures.join('; '));
console.log('Required fields and array types match parent entity contracts');
