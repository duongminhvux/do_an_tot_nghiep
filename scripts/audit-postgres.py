#!/usr/bin/env python3
"""Static overhaul audit; DOES NOT certify Docker/PostgreSQL runtime."""
from __future__ import annotations
import json,re,subprocess,sys
from pathlib import Path
try:
 import yaml
except ModuleNotFoundError:
 yaml=None
ROOT=Path(__file__).resolve().parents[1]
def load_yaml(file):
 if yaml is not None:return yaml.safe_load(file.read_text())
 # Reuse the repository's Node YAML parser when Python tooling is not installed.
 parsed=subprocess.run(['node','-e',"process.stdout.write(JSON.stringify(require('yaml').parse(require('node:fs').readFileSync(process.argv[1],'utf8'))))",str(file)],cwd=ROOT,capture_output=True,text=True,check=True)
 return json.loads(parsed.stdout)
sql=(ROOT/'database/postgres/01-init.sql').read_text()
schema=json.loads((ROOT/'database/postgres/schema-spec.json').read_text())
full=load_yaml(ROOT/'docker-compose.yml')
infra=load_yaml(ROOT/'compose.infra.yml')
roles=['identity','content','assessment','arena','learning','media','ai_import','notification']
checks={};details={}
checks['eight_owned_databases']=all(f'CREATE DATABASE %I OWNER %I' in sql and f"'{r}_db', 'vl_{r}'" in sql for r in roles)
checks['no_old_db_service']=not any('mongo' in s.lower() or 'projection' in s.lower() for s in full['services'])
checks['fresh_sql_bootstrap']=all((ROOT/'database/postgres'/n).exists() for n in ('01-init.sql','01-init.sh')) and '01-init.sh' in str(full['services']['postgres']['volumes'])
tracked_env=subprocess.run(['git','ls-files','--error-unmatch','.env'],cwd=ROOT,capture_output=True,text=True)
checks['root_env_template']=(ROOT/'.env.example').exists() and tracked_env.returncode==1
checks['local_infra_excludes_backends']=not any(n in infra['services'] for n in ['postgres','identity-service','content-service','admin-web','web','gateway'])
checks['local_infra_has_redis_rabbitmq_ai']=all(s in infra['services'] for s in ['redis','rabbitmq','tts-service','asr-service','objectstore'])
checks['versioned_sql_migrations']=(ROOT/'database/postgres/migrations/contracts.json').exists() and all(
 (ROOT/'database/postgres/migrations'/owner/'0001_baseline.sql').exists()
 for owner in ('identity','content','assessment','arena','learning','media-jobs','ai-import','notification'))
checks['seed_before_identity']=full['services']['identity-service']['depends_on']['admin-seed']['condition']=='service_completed_successfully'
checks['distinct_consumers']=full['services']['domain-consumer-learning']['environment'].get('CONSUMER_NAME')=='learning' and full['services']['domain-consumer-notification']['environment'].get('CONSUMER_NAME')=='notification'
for s in [full,infra]:
 missing=[]
 for name,service in s['services'].items():
  for dep in (service.get('depends_on') or {}):
   if dep not in s['services']:missing.append((name,dep))
 checks[f'compose_dependencies_valid_{"full" if s is full else "infra"}']=not missing
 files=[p for p in ROOT.rglob('*') if p.is_file() and p.suffix in ('.ts','.tsx','.js','.mjs','.cjs','.py','.yml','.yaml') and not any(x in p.parts for x in ('node_modules','.next','.git','dist','.tmp','.local','.agents','.codex'))]
 legacy=[]
 for f in files:
  if f == Path(__file__).resolve(): continue
  t=f.read_text(errors='replace')
  if re.search(r"(?:from\s*['\"](?:mongoose|@nestjs/mongoose|mongodb)|import\s+(?:mongoose|pymongo)|from\s+pymongo|mongosh|mongorestore|mongodump|MONGO_URI)",t):legacy.append(str(f.relative_to(ROOT)))
 checks['no_old_db_runtime_imports']=not legacy
 details['legacy_db_references']=legacy
 native=subprocess.run(['node',str(ROOT/'scripts/audit-postgres-native.cjs'),'--check-complete'],cwd=ROOT,capture_output=True,text=True)
 checks['all_database_queries_native']=native.returncode==0
 details['native_query_audit']=json.loads(native.stdout) if native.stdout.strip().startswith('{') else {'error':native.stderr}
 total_tables=sum(len(s['tables']) for s in schema['domains'].values())
 details['sql_business_tables']=total_tables
 details['sql_database_names']=[f'{r}_db' for r in roles]
 details['compose_services_full']=len(full['services']);details['compose_services_local_infra']=len(infra['services'])
 details['source_files_scanned']=len(files)
 # A B-tree index cannot directly index JSONB values: list all indexed jsonb columns.
 json_columns={};table=None
 for line in sql.splitlines():
  m=re.search(r'CREATE TABLE IF NOT EXISTS public\."([^"]+)"',line)
  if m:table=m[1];json_columns[table]=set()
  m=re.search(r'^  "([^"]+)" JSONB(?:\s|,)',line)
  if m and table:json_columns[table].add(m[1])
 invalid_indexes=[]
 for line in sql.splitlines():
  m=re.search(r'^CREATE (?:UNIQUE )?INDEX.* ON public\."([^"]+)"(?: USING GIN)? \((.*?)\)',line)
  if not m:continue
  if 'USING GIN' in line:continue
  t=m[1]
  for col in re.findall(r'"([^"]+)"',m[2]):
   if col in json_columns.get(t,set()) and f'"{col}"::text' not in line:
    invalid_indexes.append(line)
 checks['no_jsonb_btree_indexes']=not invalid_indexes
 details['invalid_index_lines']=invalid_indexes
 # This static audit does not execute the separate build/integration suites.
 checks['full_typescript_typecheck']=None
 checks['postgres_sql_executed']=None
 checks['docker_build_and_start']=None
 checks['http_end_to_end']=None
 details['known_blockers']=[
  'Full application deployment, HTTP/WebSocket traffic and Redis/RabbitMQ delivery are not certified by this static audit.',
  'Executed TypeScript, PostgreSQL 17 and concurrency test results are recorded in POSTGRES_NATIVE_REFACTOR_STATUS_VI.md.',
 ]
 result={'status':'STATIC_CHECK_ONLY_NOT_PRODUCTION_READY','checks':checks,'details':details}
 (ROOT/'POSTGRES_OVERHAUL_AUDIT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'checks_passed':sum(x is True for x in checks.values()),'checks_failed':[k for k,v in checks.items() if v is False],
 'checks_unverified':[k for k,v in checks.items() if v is None], 'business_tables':total_tables,'full_services':len(full['services'])},ensure_ascii=False,indent=2))
 sys.exit(1 if any(x is False for x in checks.values()) else 0)
