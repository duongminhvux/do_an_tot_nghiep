import {docker,project,db,http} from './admin-iam-stage-lib.mjs';
import {writeFileSync} from 'node:fs';
const services=JSON.parse(docker(['inspect',...docker(['ps','-a','--filter','label=com.docker.compose.project='+project,'--format','{{.Names}}']).trim().split('\n')]));
const identity=await db('identity'),notification=await db('notification');
const summary={at:new Date().toISOString(),project,services:services.map(c=>({name:c.Name.slice(1),state:c.State.Status,health:c.State.Health?.Status})),ready:{},counts:{}};
for(const role of ['identity','content','assessment','learning','arena','media-jobs','ai-import','notification'])summary.ready[role]=(await http('/gateway/'+role+'-ready')).status;
summary.counts.identity=(await identity.query("SELECT (SELECT count(*) FROM permissions) AS permissions,(SELECT count(*) FROM admin_roles ar JOIN roles r ON r.id=ar.role_id WHERE r.code='SUPER_ADMIN') AS super_memberships,(SELECT count(*) FROM outbox_events WHERE published_at IS NULL) AS unpublished_outbox")).rows[0];
summary.counts.notification=(await notification.query("SELECT (SELECT count(*) FROM notification_email_jobs WHERE state='completed') AS sent,(SELECT count(*) FROM notification_email_jobs WHERE state='active') AS active,(SELECT count(*) FROM activitylogs WHERE action='ADMIN_ACTIVATED') AS activation_audits")).rows[0];
writeFileSync('.tmp/admin-iam-phase6/staging-final-state.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({ready:summary.ready,counts:summary.counts}));await identity.end();await notification.end();

