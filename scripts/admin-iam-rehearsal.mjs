/** Restore authorized backups in an internal-only PostgreSQL; never starts any app/relay there. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const compose=['compose','--env-file','.tmp/admin-iam-phase6/stage.env','-f','infra/admin-iam-staging/compose.json','-p','vocalearn-iam-phase6'];
const target='vocalearn-iam-phase6-rehearsal-db-1';
const run=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:8*1024*1024,...options});
const config=JSON.parse(run(['inspect',target]))[0];if(config.Config.Labels['vocalearn.purpose']!=='admin-iam-phase6-restore-only'||Object.keys(config.NetworkSettings.Networks).length!==1||!Object.keys(config.NetworkSettings.Networks)[0].endsWith('_restore-only'))throw Error('Refusing non-isolated restore target');
const sql=(db,query)=>run(['exec','-i',target,'sh','-c','exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"','restore-check',db],{input:query}).trim();
if(sql('postgres','SHOW cluster_name;')!=='admin-iam-phase6-restore-only')throw Error('Wrong marker');
const dbs=JSON.parse(readFileSync('.tmp/admin-iam-phase6/backups/manifest.json','utf8')).databases;
run(['exec',target,'mkdir','-p','/tmp/iam-restore']);
const results=[];
for(const item of dbs){const db=item.database;
 if(sql(db,"SELECT count(*) FROM pg_tables WHERE schemaname='public';")!=='0')throw Error('Restore requires fresh isolated database: '+db);
 const remote='/tmp/iam-restore/'+db+'.dump';run(['cp','.tmp/admin-iam-phase6/backups/'+db+'.dump',target+':'+remote]);
 const toc=run(['exec',target,'pg_restore','-l',remote]);
 // public already exists in a brand-new PG database. Keep every business object/data entry.
 const list=toc.split('\n').filter(line=>!/^\d+;.* SCHEMA - public /.test(line)).join('\n');
 run(['exec','-i',target,'sh','-c','cat > /tmp/iam-restore/list.txt'],{input:list});
 run(['exec',target,'pg_restore','-U','iam_stage','--role=vl_'+db.slice(0,-3),'--no-owner','--no-acl','--exit-on-error','--single-transaction','--use-list=/tmp/iam-restore/list.txt','-d',db,remote]);
 results.push({database:db,restored:true,tables:Number(sql(db,"SELECT count(*) FROM pg_tables WHERE schemaname='public';"))});console.log('RESTORE OK',db);
}
const digestSql="BEGIN READ ONLY; SELECT md5(coalesce(jsonb_agg(jsonb_build_array(id,email,username,password_hash,payload,created_at,updated_at,is_deleted,deleted_at) ORDER BY id)::text,'[]')) FROM public.admins; ROLLBACK;";
const before=sql('identity_db',digestSql),countBefore=sql('identity_db','SELECT count(*) FROM admins;');
const migration=run([...compose,'run','--rm','--no-deps','rehearsal-migrator']);
const after=sql('identity_db',digestSql),countAfter=sql('identity_db','SELECT count(*) FROM admins;');
if(before!==after||countBefore!==countAfter)throw Error('Admin legacy fields changed in rehearsal');
const memberships=sql('identity_db','SELECT count(*) FROM admin_roles;');if(memberships!=='0')throw Error('Unexpected elevation in rehearsal');
const latest=sql('identity_db','SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;');
const report={at:new Date().toISOString(),isolatedNetwork:true,source:'authorized pg_dump backups',restored:results,migrationRunner:'scripts/migrate.mjs --all',identityVersion:latest,adminCountPreserved:true,legacyFieldsAndHashesPreserved:true,noAutomaticRoleGrants:true,permissions:Number(sql('identity_db','SELECT count(*) FROM permissions;')),ready:migration.includes('ready')||latest==='0020_admin_activation_tokens'};
writeFileSync('.tmp/admin-iam-phase6/rehearsal-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
