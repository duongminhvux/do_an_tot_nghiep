/**
 * Static parity and coverage check for Docker Nginx and local Node gateways.
 * A passing result verifies routing definitions, NOT live upstream availability.
 * Usage: node scripts/check-gateway-contract.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const nginx = fs.readFileSync(path.join(root, 'infra/gateway/nginx.conf'), 'utf8');
const dev = fs.readFileSync(path.join(root, 'scripts/dev-gateway.mjs'), 'utf8');
const nginxRules = [...nginx.matchAll(/location\s+~\s+(\S+)\s*\{\s*set\s+\$service_target\s+([\w-]+)-service:5000;\s*proxy_pass/g)]
  .map((m) => ({ re: new RegExp(m[1]), role: m[2] }));
const devRules = dev.split('\n')
  .map((line) => /^\[\s*(\/\^.+\/),\s*'([\w-]+)'\s*\],?$/.exec(line.trim()))
  .filter(Boolean)
  .map((m) => ({ re: vm.runInNewContext(m[1]), role: m[2] }));
assert.equal(nginxRules.length, 9, 'Expected nine route families, including AI-import precedence');
assert.equal(devRules.length, nginxRules.length, 'Docker/local API route family drift');
const roles = ['identity','content','assessment','arena','learning','media-jobs','ai-import','notification'];
const normalized = (url) => url.split('?')[0];
function route(rules, url) {
  const p = normalized(url);
  if (p === '/api/_internal' || p.startsWith('/api/_internal/')) return null;
  if (p.startsWith('/socket.io/')) return 'arena';
  if (p.startsWith('/media/')) return 'media-jobs';
  return rules.find(({re}) => re.test(p))?.role ?? null;
}
const fixtures = [
  ['/api/admin/content-quality/summary','content'],
  ['/api/auth/google/login','identity'],['/api/admin/auth/login','identity'],['/api/users','identity'],
  ['/api/words','content'],['/api/admin/words','content'],['/api/collections','content'],
  ['/api/vocabulary-groups','content'],['/api/lessons','content'],['/api/dictation','content'],
  ['/api/admin/dictation','content'],['/api/upload','content'],
  ['/api/exams','assessment'],['/api/admin/exams','assessment'],['/api/exam-groups','assessment'],
  ['/api/attempts','assessment'],['/api/admin/questions','assessment'],
  ['/api/admin/exams/123/pdf-ai','ai-import'],['/api/admin/exams/123/pdf-ai/preview','ai-import'],
  ['/api/admin/pdf-ai','ai-import'],['/api/pdf-ai/status','ai-import'],
  ['/api/arena/profile','arena'],['/api/admin/arena/settings','arena'],
  ['/api/learning/reviews','learning'],['/api/reviews','learning'],
  ['/api/learning-activity/home','learning'],['/api/progress','learning'],
  ['/api/sessions','learning'],['/api/minigames','learning'],['/api/admin/dashboard','learning'],
  ['/api/site-settings','media-jobs'],['/api/admin/site-settings','media-jobs'],
  ['/api/tts','media-jobs'],['/api/asr','media-jobs'],['/api/admin/audio','media-jobs'],
  ['/api/activity-logs','notification'],['/api/admin/activity-logs','notification'],
  ['/socket.io/?EIO=4&transport=polling','arena'],['/media/object','media-jobs'],
  ['/api/_internal/read-models/users',null],['/api/_internal',null],['/api/unknown',null],
];
for (const [url, expected] of fixtures) {
  assert.equal(route(nginxRules,url), expected, `Nginx route: ${url}`);
  assert.equal(route(devRules,url), expected, `Local route: ${url}`);
}
for(const role of roles) {
  assert(nginx.includes(`location = /gateway/${role}-ready`),`Missing Nginx ${role} readiness`);
  assert(dev.includes(`|${role}`)||dev.includes(`${role}|`),`Missing local ${role} readiness`);
}
// Every literal public controller prefix should have a gateway destination.
const found = [];
const ignored = [];
function walk(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()){walk(p);continue;}
    if(!/\.ts$/.test(p)||/\.spec\.ts$/.test(p))continue;
    const source=fs.readFileSync(p,'utf8');
    for(const match of source.matchAll(/@(AdminController|Controller)\(\s*(\[[^\]]+\]|'[^']+'|"[^"]+")\s*\)/g)){
      const bases=[...match[2].matchAll(/['"]([^'"]+)['"]/g)].map(x=>x[1]);
      for(const base of bases) {
        const full='/api/'+(match[1]==='AdminController'?'admin/':'')+base.replace(/:\w+/g,'fixture');
        if(full==='/api/health'||full==='/api/_internal'||full.startsWith('/api/_internal/')){ignored.push(full);continue;}
        found.push([path.relative(root,p),full,route(nginxRules,full),route(devRules,full)]);
      }
    }
  }
}
walk(path.join(root,'apps/api/src'));
const missing=found.filter(([,url,ng,local])=>!ng || ng!==local);
for(const [file,url,ng,local] of missing)console.error(`MISSING ${file}: ${url} -> nginx=${ng}, local=${local}`);
assert.equal(missing.length,0,'Public controller base routes missing or diverging');
console.log(`GATEWAY CONTRACT PASS: ${fixtures.length} route cases, ${found.length} public controller prefixes, ${roles.length} readiness probes, ${ignored.length} internal/health prefixes excluded.`);
console.log('Static routing only. Run scripts/smoke-network.mjs in Docker for live HTTP checks.');
