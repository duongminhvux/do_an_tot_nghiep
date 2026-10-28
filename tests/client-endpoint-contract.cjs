const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const directory=fs.mkdtempSync(path.join(root,'.tmp/client-contract-'));
const fixture=path.join(directory,'client.ts');
try{
  fs.writeFileSync(fixture,`import apiClient from '@/lib/axios';
apiClient.post('/vocabulary-groups');
apiClient.patch('/vocabulary-groups/fixture');
apiClient.delete('/vocabulary-groups/fixture');
apiClient.get('/words');
apiClient.get('/words/fixture');
apiClient.post('/words');
apiClient.patch('/words/fixture');
apiClient.delete('/words/fixture');
apiClient.patch('/words/fixture/restore');
apiClient.get('/admin/words');
`);
  const result=spawnSync(process.execPath,['scripts/check-client-gateway-routes.cjs','--extra-client',fixture],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout,/Client route variants: \d+; unmatched: 0/);
  assert.match(result.stdout,/Client HTTP endpoint variants: \d+; unmatched: 9/);
  assert.equal((result.stderr.match(/MISSING ENDPOINT/g)||[]).length,9);
  console.log('Client endpoint regression PASS: all 9 obsolete calls rejected; admin read accepted');
}finally{fs.unlinkSync(fixture);fs.rmdirSync(directory);}
