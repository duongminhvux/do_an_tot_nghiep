import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdtemp,cp,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url)),{Pool}=require('pg');
const {migrate,DATABASES}=await import('../apps/api/src/postgres/migrations.ts');
assert.equal(process.env.V9_ISOLATED_TEST,'true');
const poolFor=(role,readOnly=false)=>{const owner=role==='media-jobs'?'media':role.replaceAll('-','_');return new Pool({
  host:'postgres-adoption',database:DATABASES[role],user:`vl_${owner}`,password:process.env[`PG_${owner.toUpperCase()}_PASSWORD`],
  options:readOnly?'-c default_transaction_read_only=on':undefined});};
let checks=0;const pass=label=>{checks++;console.log('PASS '+label);};
const identity=poolFor('identity'),readOnly=poolFor('identity',true),id=randomUUID();
try{
  const original=await identity.query("SELECT to_regclass('public.schema_migrations') IS NULL AS absent");
  assert.equal(original.rows[0].absent,true,'Run this suite on a fresh legacy adoption fixture');
  const status=await migrate(readOnly,'identity',false);
  assert.equal(status.ready,false);assert(status.pending.length>0);
  assert.equal((await identity.query("SELECT to_regclass('public.schema_migrations') IS NULL AS absent")).rows[0].absent,true);
  pass('migration status works on a read-only connection without creating history');
  await identity.query('INSERT INTO users(id,email,username,payload) VALUES($1,$2,$3,$4::jsonb)',[id,`${id}@example.invalid`,'Preserved legacy row',JSON.stringify({fixture:id})]);
  await identity.query('ALTER TABLE users ADD COLUMN v9_unreviewed_column text');
  await assert.rejects(()=>migrate(identity,'identity'),/canonical migration reference/);
  assert.equal((await identity.query("SELECT to_regclass('public.schema_migrations') IS NULL AS absent")).rows[0].absent,true);
  assert.equal((await identity.query("SELECT to_regclass('public.aggregate_versions') IS NULL AS absent")).rows[0].absent,true);
  assert.equal((await identity.query('SELECT username,payload FROM users WHERE id=$1',[id])).rows[0].username,'Preserved legacy row');
  assert.equal((await identity.query('SELECT v9_unreviewed_column FROM users WHERE id=$1',[id])).rowCount,1);
  pass('divergent legacy schema rejects adoption and rolls back all pending DDL/history while retaining data');
  await identity.query('ALTER TABLE users DROP COLUMN v9_unreviewed_column');
  for(const role of Object.keys(DATABASES)){
    const pool=role==='identity'?identity:poolFor(role);
    try{assert.equal((await migrate(pool,role)).ready,true);assert.equal((await migrate(pool,role,false)).ready,true);}
    finally{if(pool!==identity)await pool.end();}
    pass(`${role} legacy adoption matches canonical fresh schema`);
  }
  assert.equal((await identity.query('SELECT payload FROM users WHERE id=$1',[id])).rows[0].payload.fixture,id);
  pass('successful legacy adoption preserves pre-existing payload values');
  const before=await identity.query('SELECT version,checksum,fingerprint FROM schema_migrations ORDER BY version');
  await Promise.all([migrate(identity,'identity'),migrate(identity,'identity')]);
  assert.deepEqual((await identity.query('SELECT version,checksum,fingerprint FROM schema_migrations ORDER BY version')).rows,before.rows);
  pass('concurrent migration calls remain serialized and repeatable');
  const missing=before.rows[1];
  await identity.query('DELETE FROM schema_migrations WHERE version=$1',[missing.version]);
  try{await assert.rejects(()=>migrate(identity,'identity',false),/history has a gap/);}
  finally{await identity.query('INSERT INTO schema_migrations(version,checksum,fingerprint) VALUES($1,$2,$3)',[missing.version,missing.checksum,missing.fingerprint]);}
  pass('a missing middle migration history entry is rejected');
  const cwd=process.cwd(),temp=await mkdtemp(resolve(tmpdir(),'v9-reference-'));
  await cp(resolve(cwd,'database/postgres/migrations'),resolve(temp,'database/postgres/migrations'),{recursive:true});
  const path=resolve(temp,'database/postgres/migrations/contracts.json'),contracts=JSON.parse(await readFile(path,'utf8'));
  contracts.identity.migrationsChecksum='0'.repeat(64);await writeFile(path,JSON.stringify(contracts));process.chdir(temp);
  try{await assert.rejects(()=>migrate(identity,'identity',false),/reference is missing or stale/);}
  finally{process.chdir(cwd);}
  pass('stale canonical manifest fails closed before touching schema');
  console.log(`${checks} focused migration adoption checks passed`);
}finally{await identity.end();await readOnly.end();}
