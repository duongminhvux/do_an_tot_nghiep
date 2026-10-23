import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const roles = ['identity','content','assessment','learning','arena','media-jobs','ai-import','notification','audio-worker'];
for (const role of roles) {
  console.log(`\n=== Build ${role} ===`);
  const cmd = spawnSync('pnpm', ['--dir','apps/api','exec','tsc','-p',`tsconfig.roles/${role}.json`],
    {cwd:resolve(import.meta.dirname,'..'),stdio:'inherit',shell:process.platform==='win32'});
  if (cmd.status !== 0) process.exit(cmd.status || 1);
}
