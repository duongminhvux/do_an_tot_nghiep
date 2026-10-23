#!/usr/bin/env python3
"""Static architecture and first-boot contract checks, without a Docker daemon."""
from pathlib import Path
import json, sys
import yaml
R=Path(__file__).resolve().parent.parent
c=yaml.safe_load((R/'docker-compose.yml').read_text())
services=c['services']
schema=json.loads((R/'database/schema/collections.json').read_text())
imports=json.loads((R/'database/import/ownership.json').read_text())
roles=list(schema['databases'])
errors=[]
def require(ok,why):
    if not ok:errors.append(why)
require('db-init' in services,'db-init missing')
require('mongo-init' not in services,'obsolete mongo-init still present')
require('cutover' not in services,'obsolete cutover service still present')
require(services.get('db-init',{}).get('build',{}).get('dockerfile')=='database/Dockerfile', 'db-init must build schema image on manifest changes')
require(services.get('db-init',{}).get('command',[])[-1]=='/bootstrap/init.js','db-init does not call schema bootstrap')
require('COPY database/schema/collections.json' in (R/'database/Dockerfile').read_text(),'db-init image does not COPY schema')
require(not any(p.name=='cutover.mjs' for p in R.rglob('*.mjs')),'legacy cutover file exists')
require(not (R/'database/cutover').exists(),'old cutover folder still exists')
for role in roles:
    svc=services.get(role+'-service')
    require(bool(svc),'Missing '+role+'-service')
    if not svc:continue
    require('db-init' in svc.get('depends_on',{}),'Missing db-init dependency: '+role)
    require(svc.get('environment',{}).get('MONGO_DB_NAME')==schema['databases'][role],'Wrong database: '+role)
    require(schema['databases'][role] in svc['environment']['MONGO_URI'],'Wrong Mongo connection: '+role)
    require('english-platform' not in svc['environment']['MONGO_URI'],'Legacy database in service: '+role)
for name, svc in services.items():
    for dep in svc.get('depends_on',{}):
        require(dep in services, f'{name} depends on missing {dep}')
    if 'MONGO_URI' in (svc.get('environment') or {}) and name!='mongo':
        require('db-init' in svc.get('depends_on',{}),f'{name} needs database bootstrap dependency')
owner={}
for role, names in imports['collections'].items():
    for name in names:
        require(name not in owner,'Duplicate owner: '+name)
        owner[name]=role
        require(name in schema['collections'][role],f'Missing initial collection: {role}.{name}')
for coll, targets in imports['projections'].items():
    require(coll in owner,'Unknown projection source '+coll)
    for target in targets:
        require(schema['collections'][target].get(coll,{}).get('readOnlyProjection')==True,
                f'Missing read projection: {target}.{coll}')
for role in roles:
    require('database_versions' in schema['collections'][role], 'Missing schema marker '+role)
    require('import_history' in schema['collections'][role], 'Missing import history '+role)
    for name, spec in schema['collections'][role].items():
        for index in spec.get('indexes',[]):
            require(index['key'], f'Empty index {role}.{name}')
            require(all(isinstance(v,(int,str)) for v in index['key'].values()),f'Invalid index key {role}.{name}')
require((R/'scripts/import-legacy-dump.ps1').exists(),'Missing manual .dump import script')
for needle in ['one_time_cutover_v1','service_bootstrap']:
    for path in [R/'apps/api/src/platform/bootstrap.ts',R/'apps/api/src/audio-worker-main.ts',R/'services/projections/projection.py']:
        require(needle not in path.read_text(),f'Legacy DB guard remains in {path}')
api_builders=[name for name,svc in services.items() if svc.get('build',{}).get('dockerfile')=='apps/api/Dockerfile']
require(len(api_builders)==1,'Node API should be compiled exactly once')
require(all(svc.get('image')=='vocalearn-clean-api:local' for name,svc in services.items() if name in [f'{role}-service' for role in roles] or name=='audio-worker'), 'API runtimes must use shared image')
if errors:
    print('\n'.join('FAIL: '+x for x in errors))
    raise SystemExit(1)
print(f'PASS: {len(roles)} owned databases; {len(owner)} business collections; '
      f'{sum(len(x) for x in schema["collections"].values())} collections including projections/system; '
      f'{len(services)} Docker services; clean startup independent of legacy backup.')
