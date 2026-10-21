#!/usr/bin/env python3
"""Generate central inventory of Mongoose schema source files.
Review changes and add numbered migrations for schema/index changes before deployment.
"""
from pathlib import Path
import re,hashlib,json
root=Path(__file__).resolve().parent.parent
items=[]
for path in sorted((root/'apps/api/src/modules').rglob('*.schema.ts')):
    raw=path.read_bytes()
    text=raw.decode('utf-8')
    names=re.findall(r'@Schema\s*\([^)]*\)\s*\n\s*export class\s+(\w+)',text)
    items.append({'path':path.relative_to(root).as_posix(),
                  'models':names,'sha256':hashlib.sha256(raw).hexdigest()})
out=root/'database/schema-manifest.json'
out.write_text(json.dumps({'format':'mongoose-source-registry-v1','models':items},indent=2,ensure_ascii=False)+'\n')
print(f'Updated {out} ({len(items)} schema source files)')
