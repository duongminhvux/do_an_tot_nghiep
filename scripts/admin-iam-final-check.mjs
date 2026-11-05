/** Final read-only comparison with the production inventory taken before staging. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const directory='.tmp/admin-iam-phase6',before=JSON.parse(readFileSync(directory+'/preflight-services.json','utf8'));
const docker=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:8*1024*1024,...options});
const now=JSON.parse(docker(['inspect',...before.services.map(s=>s.name)]));
const comparison=before.services.map(old=>{const current=now.find(c=>c.Name.slice(1)===old.name);return {name:old.name,sameContainer:current.Id===old.id,sameImage:current.Image===old.imageId,sameStartedAt:current.State.StartedAt===old.startedAt,state:current.State.Status,health:current.State.Health?.Status};});
assert(comparison.every(s=>s.sameContainer&&s.sameImage&&s.sameStartedAt),'Existing stack changed during QA');
const history=JSON.parse(readFileSync(directory+'/preflight-databases.json','utf8')),databases=[];
for(const old of history){const sql="BEGIN READ ONLY; SELECT json_build_object('database',current_database(),'versions',(SELECT json_agg(version ORDER BY version) FROM public.schema_migrations),'lastFingerprint',(SELECT fingerprint FROM public.schema_migrations ORDER BY version DESC LIMIT 1))::text; ROLLBACK;";const raw=docker(['exec','-i','vocalearn-postgres-postgres-1','sh','-c','exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"','readonly-final',old.database],{input:sql});const current=JSON.parse(raw.trim());assert.deepEqual(current,old);databases.push({database:old.database,historyUnchanged:true});}
const backup=JSON.parse(readFileSync(directory+'/backups/manifest.json','utf8'));
for(const item of backup.databases){const hash=createHash('sha256');for await(const chunk of createReadStream(directory+'/backups/'+item.database+'.dump'))hash.update(chunk);assert.equal(hash.digest('hex'),item.sha256);}
writeFileSync(directory+'/production-final-check.json',JSON.stringify({at:new Date().toISOString(),existingContainers:comparison,databases,backupChecksumsVerified:backup.databases.length,productionMigrationApplied:false,productionBootstrapApplied:false},null,2));
console.log('PASS: all '+comparison.length+' original container IDs/images/start timestamps and all 8 migration histories unchanged; 8 backup SHA256 verified');
