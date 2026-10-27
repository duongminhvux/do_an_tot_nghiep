/** Backfill public display profiles for accounts created before domain events.
 * Default: preview count. --apply enqueues versioned Identity events; consumers
 * update their own projections. No email or credentials leave Identity.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
const require = createRequire(resolve(root, 'apps/api/package.json'));
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5432),
  database: 'identity_db', user: 'vl_identity',
  password: process.env.PG_IDENTITY_PASSWORD || process.env.PGPASSWORD,
  connectionTimeoutMillis: 5000,
});
const candidates = `SELECT id, username, avatar_url, is_banned,
  floor(extract(epoch FROM coalesce(updated_at,created_at))*1000)::bigint AS version
  FROM public.users WHERE is_deleted IS NOT TRUE`;
const snapshots = `SELECT id, jsonb_build_object('userId',id,'username',username,
  'avatarUrl',avatar_url,'isBanned',coalesce(is_banned,false),'sourceVersion',version) AS snapshot
  FROM (${candidates}) users`;
const pending = `SELECT * FROM (${snapshots}) snapshots WHERE NOT EXISTS (
  SELECT 1 FROM public.outbox_events e WHERE e.aggregate_id=snapshots.id
  AND e.event_type IN ('identity.user.created.v1','identity.user.updated.v1')
  AND e.payload->>'sourceVersion'=snapshots.snapshot->>'sourceVersion'
)`;
try {
  if (process.argv.includes('--apply')) {
    const result = await pool.query(`INSERT INTO public.outbox_events
      (event_id,event_type,aggregate_type,aggregate_id,payload)
      SELECT gen_random_uuid(),'identity.user.updated.v1','identity',id,snapshot
      FROM (${pending}) pending RETURNING event_id`);
    console.log(JSON.stringify({ enqueued: result.rowCount }));
  } else {
    const result = await pool.query(`SELECT count(*)::int AS pending FROM (${pending}) pending`);
    console.log(JSON.stringify({ ...result.rows[0], apply: false }));
  }
} finally { await pool.end(); }
