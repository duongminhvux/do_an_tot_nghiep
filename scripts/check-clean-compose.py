#!/usr/bin/env python3
"""Basic independent YAML sanity check (Docker Compose CLI still authoritative)."""
import sys
from pathlib import Path
import yaml
path=Path(__file__).resolve().parents[1]/'docker-compose.yml'
d=yaml.safe_load(path.read_text(encoding='utf-8'))
expected={'name','services','networks','volumes','secrets','configs','version','include'}
extra=set(d)-expected
if extra:
    sys.exit(f'ERROR: Unexpected root fields: {sorted(extra)}. Environment variables must be nested under services.<name>.environment.')
services=d.get('services',{})
if not services: sys.exit('ERROR: No services found')
for name,s in services.items():
    if not isinstance(s,dict): sys.exit(f'ERROR: Invalid service {name}')
    for dep in (s.get('depends_on') or {}):
        if dep not in services: sys.exit(f'ERROR: {name} depends on undefined service {dep}')
    for k,v in (s.get('environment') or {}).items():
        if not isinstance(k,str): sys.exit(f'ERROR: Invalid environment key in {name}')
assert 'db-init' in services
assert 'cutover' not in services
assert 'objectstore' in services
assert 'minio-init' not in services
assert services['db-init']['command'][-1]=='/bootstrap/init.js'
assert services['objectstore']['image'].startswith('chrislusf/seaweedfs:')
print(f'OK: {len(services)} services, fresh database initialization and maintained S3-compatible image')
