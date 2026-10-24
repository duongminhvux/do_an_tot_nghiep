/** Generate reviewed references from EMPTY disposable owner databases only.
 * Every DDL/DML statement is rolled back. No live schema can be adopted here.
 * Run from repository root with PGHOST + per-owner PG_*_PASSWORD configured.
 */
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');process.chdir(root);
const require=createRequire(resolve(root,'apps/api/package.json')),{Pool}=require('pg');
const {DATABASES,migrationsFor,migrationSetChecksum,schemaFingerprint}=await import('../apps/api/src/postgres/migrations.ts');
const contracts={};
for(const role of Object.keys(DATABASES)){
  const owner=role==='media-jobs'?'media':role.replaceAll('-','_');
  const pool=new Pool({host:process.env.PGHOST,port:Number(process.env.PGPORT||5432),database:DATABASES[role],user:`vl_${owner}`,
    password:process.env[`PG_${owner.toUpperCase()}_PASSWORD`],connectionTimeoutMillis:10000});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='120s'");
    const existing=await client.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v','m','S','f')");
    if(existing.rows[0].count!==0)throw new Error(`Reference generation requires an empty ${DATABASES[role]}; existing objects were preserved`);
    const migrations=await migrationsFor(role);
    for(const migration of migrations)await client.query(migration.sql);
    contracts[role]={version:migrations.at(-1).version,migrationsChecksum:migrationSetChecksum(migrations),fingerprint:await schemaFingerprint(client)};
  }finally{await client.query('ROLLBACK');client.release();await pool.end();}
}
const output=JSON.stringify(contracts,null,2)+'\n';
if(process.argv.includes('--write')){
  await writeFile(resolve(root,'database/postgres/migrations/contracts.json'),output);
  console.log('Generated references for 8 empty databases; all reference DDL was rolled back. Review the manifest diff.');
}else process.stdout.write(output);
