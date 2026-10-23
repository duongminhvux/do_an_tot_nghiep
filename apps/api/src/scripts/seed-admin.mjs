import pg from 'pg';
import bcrypt from 'bcrypt';
import {loadRootEnv} from './load-root-env.mjs';
import {isEnabled,parseSeedOptions,seedAdminSql} from './seed-admin-core.mjs';
loadRootEnv();
const argv=process.argv.slice(2), automatic=argv.includes('--auto');
if(automatic && !isEnabled(process.env.ADMIN_SEED_ENABLED)){
  console.log('[admin-seed] Disabled');process.exit(0);
}
const {Pool}=pg;
const pool=new Pool(process.env.DATABASE_URL ? {connectionString:process.env.DATABASE_URL} : {
  host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),
  database:'identity_db', user:process.env.PGUSER||'vl_identity',password:process.env.PGPASSWORD||process.env.PG_IDENTITY_PASSWORD,
});
try{
  const options=parseSeedOptions(argv,process.env);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await seedAdminSql(client,options,bcrypt.hash);
    console.log('[admin-seed]',result.status,result.email);
    await client.query('COMMIT');
  }catch(err){await client.query('ROLLBACK');throw err;}finally{client.release();}
}catch(err){console.error('[admin-seed]',err);process.exitCode=1;}finally{await pool.end();}
