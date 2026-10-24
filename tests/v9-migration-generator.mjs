import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
assert.equal(process.env.V9_ISOLATED_TEST,'true');
const require=createRequire(new URL('../apps/api/package.json',import.meta.url)),{Pool}=require('pg');
const pool=new Pool({host:'postgres-adoption',database:'identity_db',user:'vl_identity',password:process.env.PG_IDENTITY_PASSWORD});
try{
  const before=(await pool.query('SELECT id,payload FROM users ORDER BY id')).rows;
  const result=spawnSync(process.execPath,['scripts/generate-schema-contracts.mjs'],{encoding:'utf8',env:{...process.env,PGHOST:'postgres-adoption'}});
  assert.notEqual(result.status,0);assert.match(result.stderr,/requires an empty identity_db/);
  assert.deepEqual((await pool.query('SELECT id,payload FROM users ORDER BY id')).rows,before);
  console.log('PASS reference generator rejects a populated database and preserves its rows');
}finally{await pool.end();}
