import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,statSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
const root='.tmp/admin-iam-phase6/backups';mkdirSync(root,{recursive:true});
const container='vocalearn-postgres-postgres-1',dbs=['identity','content','assessment','arena','learning','media','ai_import','notification'];
const run=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',...options});
const history=[];
for(const name of dbs){const db=name+'_db';const sql=`BEGIN READ ONLY; SELECT json_build_object('database',current_database(),'versions',(SELECT json_agg(version ORDER BY version) FROM public.schema_migrations),'lastFingerprint',(SELECT fingerprint FROM public.schema_migrations ORDER BY version DESC LIMIT 1))::text; ROLLBACK;`;
 const raw=run(['exec','-i',container,'sh','-c','exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"','audit',db],{input:sql});history.push(JSON.parse(raw.trim()));}
writeFileSync('.tmp/admin-iam-phase6/preflight-databases.json',JSON.stringify(history,null,2));console.log('READONLY HISTORY:',JSON.stringify(history));
run(['exec',container,'sh','-c','mkdir -p /tmp/admin-iam-phase6-backup && chmod 700 /tmp/admin-iam-phase6-backup']);
const result=[];
for(const name of dbs){const db=name+'_db',remote='/tmp/admin-iam-phase6-backup/'+db+'.dump',local=root+'/'+db+'.dump';
 run(['exec',container,'sh','-c','exec pg_dump -U "$POSTGRES_USER" --format=custom --no-owner --no-acl --file "$2" "$1"','backup',db,remote]);
 run(['cp',container+':'+remote,local]);const hash=createHash('sha256');for await(const chunk of createReadStream(local))hash.update(chunk);result.push({database:db,bytes:statSync(local).size,sha256:hash.digest('hex')});console.log('BACKUP OK',db,statSync(local).size,'bytes');}
writeFileSync(root+'/manifest.json',JSON.stringify({at:new Date().toISOString(),format:'pg_dump custom; no owner or ACL',databases:result},null,2));
