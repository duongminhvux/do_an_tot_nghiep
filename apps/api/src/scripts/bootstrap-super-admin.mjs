import pg from 'pg';
import {loadRootEnv} from './load-root-env.mjs';
import {bootstrapSuperAdmin,parseBootstrapOptions} from './bootstrap-super-admin-core.mjs';

// No startup hook. Default is read-only preview; mutation requires explicit --apply.
const options=parseBootstrapOptions(process.argv.slice(2));
loadRootEnv();
const pool=new pg.Pool(process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{
  host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),database:'identity_db',
  user:process.env.PGUSER||'vl_identity',password:process.env.PGPASSWORD||process.env.PG_IDENTITY_PASSWORD,
});
try {
  const client=await pool.connect();
  try {
    const {rows:[owner]}=await client.query('SELECT current_database() AS name');
    if(owner.name!=='identity_db')throw new Error('Bootstrap requires the explicit identity_db owner database');
    console.log(JSON.stringify(await bootstrapSuperAdmin(client,options)));
  } finally {client.release();}
} catch(error) {console.error('[admin-bootstrap]',error.message);process.exitCode=1;} finally {await pool.end();}
