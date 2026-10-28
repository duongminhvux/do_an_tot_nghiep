const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const args of [
  ['scripts/audit-postgres-native.cjs','--check-complete'],
  ['tests/schema-contracts.cjs'],
  ['tests/native-owner-reads.cjs'],
  ['tests/postgres-native-content.cjs'],
  ['tests/postgres-native-domains.cjs'],
]){
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});
  if(result.status!==0)process.exit(result.status??1);
}
