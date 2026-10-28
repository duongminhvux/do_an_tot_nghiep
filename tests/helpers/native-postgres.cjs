const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:[path.resolve(__dirname,'../../apps/api')]}));
const load=require('./load-typescript.cjs');
const root=path.resolve(__dirname,'../..');
const source=p=>load(path.join(root,'apps/api/src',p));
const {createConnection}=source('postgres/connection.ts');
async function nativePostgres(domains){
  const database=new PGlite(),statements=[];
  const migrations=[...domains,'common'].flatMap(domain=>{
    const directory=path.join(root,'database/postgres/migrations',domain);
    return fs.readdirSync(directory).filter(name=>name.endsWith('.sql')&&name!=='0009_numeric_collation.sql').map(name=>({name,file:path.join(directory,name)}));
  }).sort((a,b)=>a.name.localeCompare(b.name));
  try{for(const migration of migrations)await database.exec(fs.readFileSync(migration.file,'utf8'));}catch(error){await database.close();throw error;}
  const query=async(text,params=[])=>{statements.push({text,params});try{return await database.query(text,params);}catch(error){error.message+='\nSQL: '+text;throw error;}};
  // The pool uses one PostgreSQL client. Acquiring it queues concurrent transactions.
  let tail=Promise.resolve();
  const pool={query,connect:async()=>{const previous=tail;let unlock;tail=new Promise(resolve=>unlock=resolve);await previous;return {query,release:unlock};}};
  return {database,connection:createConnection(pool),statements,close:()=>database.close()};
}
module.exports={nativePostgres,source};
